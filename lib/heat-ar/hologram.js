import {Controller} from './vendor/mindar-image.prod.js'; // MindAR 1.2.5
import * as THREE from './vendor/three.module.min.js'; // Three.js 0.160.1

const targetUrl = new URL('./heat-targets.mind', import.meta.url);
const cubeSize = 0.49;
const agencyMessage = 'Agents of Howell Sneak are cool. 98°F';

function createChip(cooled) {
  const temperature = cooled ? '80°F' : '200°F';
  const chip = new THREE.Group();
  chip.position.z = 0.34;
  chip.rotation.set(-0.28, 0.43, 0.04);

  const box = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const glass = new THREE.MeshBasicMaterial({
    color: cooled ? 0x9bdeff : 0xfff8f8, transparent: true, opacity: cooled ? 0.34 : 0.24,
    side: THREE.DoubleSide, depthWrite: false,
  });
  chip.add(new THREE.Mesh(box, glass));

  const outlines = new THREE.EdgesGeometry(box);
  const points = outlines.getAttribute('position');
  const bar = new THREE.CylinderGeometry(0.013, 0.013, cubeSize, 8);
  const edgeMaterial = new THREE.MeshBasicMaterial({color: cooled ? 0x72caf6 : 0x760d21});
  const up = new THREE.Vector3(0, 1, 0);
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const direction = new THREE.Vector3();
  for (let i = 0; i < points.count; i += 2) {
    start.fromBufferAttribute(points, i);
    end.fromBufferAttribute(points, i + 1);
    const edge = new THREE.Mesh(bar, edgeMaterial);
    edge.position.copy(start).lerp(end, 0.5);
    edge.quaternion.setFromUnitVectors(up, direction.subVectors(end, start).normalize());
    chip.add(edge);
  }
  outlines.dispose();

  const label = document.createElement('canvas');
  label.width = 512;
  label.height = 256;
  const context = label.getContext('2d');
  context.font = 'bold 73px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = 10;
  context.strokeStyle = cooled ? '#e1f7ff' : '#fff2ef';
  context.fillStyle = cooled ? '#08395c' : '#510a18';
  for (const [line, y] of [['Mega AI', 51], ['Chip 01', 125]]) {
    context.strokeText(line, 256, y);
    context.fillText(line, 256, y);
  }
  context.beginPath();
  context.roundRect(117, 174, 278, 75, 14);
  context.fillStyle = cooled ? '#e1f7ffed' : '#fff2efed';
  context.fill();
  context.fillStyle = cooled ? '#08395c' : '#510a18';
  context.font = 'bold 76px ui-monospace, monospace';
  context.fillText(temperature, 256, 211);
  const texture = new THREE.CanvasTexture(label);
  texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.PlaneGeometry(cubeSize * 0.9, cubeSize * 0.45);
  const ink = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false});
  const lettering = new THREE.Mesh(face, ink);
  lettering.position.z = cubeSize / 2 + 0.003;
  lettering.renderOrder = 2;
  chip.add(lettering);

  return {
    object: chip,
    message: `Mega AI Chip 01 detected · ${temperature}`,
    dispose() {
      for (const resource of [box, glass, bar, edgeMaterial, texture, face, ink]) resource.dispose();
    },
  };
}

function createAgencyReveal() {
  const artwork = document.createElement('canvas');
  artwork.width = 768;
  artwork.height = 580;
  const context = artwork.getContext('2d');
  const center = artwork.width / 2;

  context.beginPath();
  context.roundRect(12, 12, 744, 556, 44);
  context.fillStyle = '#260911e8';
  context.fill();
  context.strokeStyle = '#ffbbb4';
  context.lineWidth = 8;
  context.stroke();

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#ffcf59';
  context.font = '192px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  context.fillText('😎', center, 173);
  context.fillStyle = '#fff1ee';
  context.font = 'bold 52px system-ui, sans-serif';
  context.fillText('Agents of Howell Sneak', center, 329);
  context.fillText('are cool.', center, 393);
  context.fillStyle = '#ffb2ad';
  context.font = 'bold 76px ui-monospace, monospace';
  context.fillText('98°F', center, 492);

  const texture = new THREE.CanvasTexture(artwork);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.PlaneGeometry(0.9, 0.9 * artwork.height / artwork.width);
  const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false});
  const object = new THREE.Mesh(plane, material);
  object.position.z = 0.025;
  return {
    object,
    message: agencyMessage,
    dispose() {
      for (const resource of [texture, plane, material]) resource.dispose();
    },
  };
}

export async function startHeatTracking(video, view, signal, {chipState, onTracking}) {
  const response = await fetch(targetUrl, {signal});
  if (!response.ok) throw Error('Could not load the scanner target.');
  const target = await response.arrayBuffer();
  signal.throwIfAborted();

  const overlay = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({canvas: overlay, alpha: true, antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  overlay.className = 'heat-scanner-hologram';
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  view.append(overlay);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const anchor = new THREE.Group();
  anchor.matrixAutoUpdate = false;
  const chips = {hot:createChip(false),cooled:createChip(true)};
  const agency = createAgencyReveal();
  const reveals = [...Object.values(chips), agency];
  anchor.add(...reveals.map(({object})=>object));
  scene.add(anchor);

  const frame = document.createElement('canvas');
  const frameContext = frame.getContext('2d');
  let activeTarget = -1;
  let activeReveal;
  let stopController;
  let projection;
  let videoWidth, videoHeight;

  function layout() {
    const width = view.clientWidth;
    const height = view.clientHeight;
    if (!projection || !width || !height) return;
    // Match the camera video's centered object-fit: cover crop.
    const cover = Math.max(width / videoWidth, height / videoHeight);
    renderer.setSize(width, height, false);
    camera.projectionMatrix.fromArray(projection);
    camera.projectionMatrix.elements[0] *= videoWidth * cover / width;
    camera.projectionMatrix.elements[5] *= videoHeight * cover / height;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  function showTracking(targetIndex) {
    // Target order in heat-targets.mind: artwork, print logo, web logo.
    const isChip = targetIndex === 0;
    const reveal = isChip ? chips[chipState()] : targetIndex > 0 ? agency : undefined;
    if (activeTarget === targetIndex && activeReveal === reveal) return;
    activeTarget = targetIndex;
    activeReveal = reveal;
    for (const item of reveals) item.object.visible = item === reveal;
    overlay.hidden = !reveal;
    onTracking(reveal?.message ?? '',isChip && Boolean(reveal));
  }

  function configureTracker() {
    if (!video.videoWidth || !video.videoHeight ||
        (videoWidth === video.videoWidth && videoHeight === video.videoHeight)) return;
    stopController?.();
    showTracking(-1);
    videoWidth = video.videoWidth;
    videoHeight = video.videoHeight;
    const scale = Math.min(1, 640 / Math.max(videoWidth, videoHeight));
    frame.width = Math.round(videoWidth * scale);
    frame.height = Math.round(videoHeight * scale);

    const drawFrame = () => frameContext.drawImage(video, 0, 0, frame.width, frame.height);
    let stopped = false;
    let disposeTimer;
    let centeredTargets;
    const controller = new Controller({
      inputWidth: frame.width,
      inputHeight: frame.height,
      onUpdate({type, targetIndex, worldMatrix}) {
        if (type === 'processDone') {
          // Let the in-flight frame finish before disposing the tracking worker.
          if (stopped) {
            clearTimeout(disposeTimer);
            controller.dispose();
          } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) drawFrame();
          return;
        }
        if (stopped || type !== 'updateMatrix') return;
        if (!worldMatrix) {
          if (activeTarget === targetIndex) showTracking(-1);
          return;
        }
        showTracking(targetIndex);
        if (overlay.hidden) return;
        anchor.matrix.fromArray(worldMatrix).multiply(centeredTargets[targetIndex]);
        anchor.matrixWorldNeedsUpdate = true;
        renderer.render(scene, camera);
      },
    });

    try {
      const {dimensions} = controller.addImageTargetsFromBuffer(target);
      centeredTargets = dimensions.map(([width, height]) =>
        new THREE.Matrix4().makeScale(width, width, width).setPosition(width / 2, height / 2, 0));
      projection = controller.getProjectionMatrix();
      layout();
      drawFrame();
      controller.dummyRun(frame);
      controller.processVideo(frame);
    } catch (error) {
      controller.dispose();
      throw error;
    }
    stopController = () => {
      stopped = true;
      controller.stopProcessVideo();
      // If the loop was between frames, there will be no final update.
      disposeTimer = setTimeout(() => controller.dispose(), 1000);
    };
  }

  const observer = new ResizeObserver(layout);
  function cleanup() {
    observer.disconnect();
    video.removeEventListener('resize', onVideoResize);
    signal.removeEventListener('abort', cleanup);
    stopController?.();
    overlay.remove();
    for (const reveal of reveals) reveal.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  function onVideoResize() {
    try {
      configureTracker();
    } catch {
      cleanup();
      onTracking(null);
    }
  }
  signal.addEventListener('abort', cleanup, {once: true});
  observer.observe(view);
  video.addEventListener('resize', onVideoResize);
  try {
    configureTracker();
  } catch (error) {
    cleanup();
    throw error;
  }
}
