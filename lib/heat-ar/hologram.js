import {Controller} from './vendor/mindar-image.prod.js'; // MindAR 1.2.5
import * as THREE from './vendor/three.module.min.js'; // Three.js 0.160.1

const targetUrl = new URL('./mega-ai-chip.mind', import.meta.url);
const cubeSize = 0.49;

function createChip() {
  const chip = new THREE.Group();
  chip.position.z = 0.34;
  chip.rotation.set(-0.28, 0.43, 0.04);

  const box = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const glass = new THREE.MeshBasicMaterial({
    color: 0xfff8f8, transparent: true, opacity: 0.24,
    side: THREE.DoubleSide, depthWrite: false,
  });
  chip.add(new THREE.Mesh(box, glass));

  const outlines = new THREE.EdgesGeometry(box);
  const points = outlines.getAttribute('position');
  const bar = new THREE.CylinderGeometry(0.013, 0.013, cubeSize, 8);
  const red = new THREE.MeshBasicMaterial({color: 0x760d21});
  const up = new THREE.Vector3(0, 1, 0);
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const direction = new THREE.Vector3();
  for (let i = 0; i < points.count; i += 2) {
    start.fromBufferAttribute(points, i);
    end.fromBufferAttribute(points, i + 1);
    const edge = new THREE.Mesh(bar, red);
    edge.position.copy(start).lerp(end, 0.5);
    edge.quaternion.setFromUnitVectors(up, direction.subVectors(end, start).normalize());
    chip.add(edge);
  }
  outlines.dispose();

  const label = document.createElement('canvas');
  label.width = 512;
  label.height = 256;
  const context = label.getContext('2d');
  context.font = 'bold 82px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = 10;
  context.strokeStyle = '#fff2ef';
  context.fillStyle = '#510a18';
  for (const [line, y] of [['Mega AI', 77], ['Chip 01', 175]]) {
    context.strokeText(line, 256, y);
    context.fillText(line, 256, y);
  }
  const texture = new THREE.CanvasTexture(label);
  texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.PlaneGeometry(cubeSize * 0.9, cubeSize * 0.45);
  const ink = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false});
  const lettering = new THREE.Mesh(face, ink);
  lettering.position.z = cubeSize / 2 + 0.003;
  lettering.renderOrder = 2;
  chip.add(lettering);

  return {
    chip,
    dispose() {
      for (const resource of [box, glass, bar, red, texture, face, ink]) resource.dispose();
    },
  };
}

export async function startHeatTracking(video, view, signal, onTracking) {
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
  const {chip, dispose} = createChip();
  anchor.add(chip);
  scene.add(anchor);

  const centeredTarget = new THREE.Matrix4();
  const frame = document.createElement('canvas');
  const frameContext = frame.getContext('2d');
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

  function showTracking(found) {
    if (overlay.hidden === !found) return;
    overlay.hidden = !found;
    onTracking(found);
  }

  function configureTracker() {
    if (!video.videoWidth || !video.videoHeight ||
        (videoWidth === video.videoWidth && videoHeight === video.videoHeight)) return;
    stopController?.();
    showTracking(false);
    videoWidth = video.videoWidth;
    videoHeight = video.videoHeight;
    const scale = Math.min(1, 640 / Math.max(videoWidth, videoHeight));
    frame.width = Math.round(videoWidth * scale);
    frame.height = Math.round(videoHeight * scale);

    const drawFrame = () => frameContext.drawImage(video, 0, 0, frame.width, frame.height);
    let stopped = false;
    let disposeTimer;
    const controller = new Controller({
      inputWidth: frame.width,
      inputHeight: frame.height,
      onUpdate({type, worldMatrix}) {
        if (type === 'processDone') {
          // Let the in-flight frame finish before disposing the tracking worker.
          if (stopped) {
            clearTimeout(disposeTimer);
            controller.dispose();
          } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) drawFrame();
          return;
        }
        if (stopped || type !== 'updateMatrix') return;
        showTracking(Boolean(worldMatrix));
        if (!worldMatrix) return;
        anchor.matrix.fromArray(worldMatrix).multiply(centeredTarget);
        anchor.matrixWorldNeedsUpdate = true;
        renderer.render(scene, camera);
      },
    });

    try {
      const {dimensions: [[width, height]]} = controller.addImageTargetsFromBuffer(target);
      centeredTarget.makeScale(width, width, width).setPosition(width / 2, height / 2, 0);
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
    dispose();
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
