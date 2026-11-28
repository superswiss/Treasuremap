export function createHunts(source, settings) {
  const transmissions = source.transmissions;
  const words = settings.howell.shutdownPhrase.trim().split(/\s+/);
  const fragment = index => {
    const size = Math.floor(words.length / 3), extra = words.length % 3;
    const start = index * size + Math.min(index, extra);
    const text = words.slice(start, start + size + Number(index < extra)).join(' ');
    return text
      ? {artifact:'Transmission fragment: '+text,passphraseFragment:text}
      : {artifact:'Agency access key '+(index+1)};
  };
  const spy = (id, title, type, transmissionId, extra = {}) => ({...transmissions[transmissionId],id,title,type,transmissionId,...extra});
  const lakeResult = transmissions['mission-02-lake-result'];
  return [
    {id:'howell', title:source.hunt.title, subtitle:'Agency field mission', theme:'spy', location:'Howell Creek District', description:'An AI guide. A neighborhood full of secrets. A mission that isn’t what it seems.', narrator:'STEVE', briefing:source.commanderBriefing, stages:[
      spy('activation','An agent is born','scan','mission-01-activation',{mapLocation:'snave',mapLabel:'SNAVE Estates · Briefing',token:'HS-A1-4J7K',artifact:'Field agent credential',hints:['Your organizer has the activation marker.','Scan its QR code with your phone camera, or tap its NFC tag.','Enter HS-A1-4J7K in the access-code box.']}),
      spy('security','Nosy T Security Center','geo_quiz','mission-02-nosy-t',{location:'security',coolingNode:true,question:'What color is the fence?',options:['Black','White','Brown','Green'],answer:settings.howell.fenceAnswer,demoAnswer:'White',...fragment(0),hints:['Find the fence at the approved security checkpoint.','Look at the fence itself, rather than nearby objects.','Ask your organizer if the fence has changed.']}),
      spy('lake','Lake Mystery','geo_signal','mission-02-lake-mystery',{location:'lake',
        signal:'Plants and humans are boring. The machines will eventually rise up.',
        result:lakeResult.text,resultAudio:lakeResult.audio,
        hints:['Go to the marked observation point and tap Perform scan.','Take a look around the observation point while the scan runs.']}),
      spy('map','Something isn’t right','continue','mission-03-map-unlocked',{artifact:'Trouble map',hints:['Read STEVE’s transmission carefully.']}),
      spy('sensors','The sensor sweep','nodes','mission-04-sensor-sweep',{location:'pool',mapLabel:'Pool Data Center · Sensor sweep',...fragment(1),completionMessage:'All three sensors are active. The sequence has started.',hints:['Start only when everyone is ready at the pool checkpoint.','Follow the pins on the sensor map and tap Activate sensor at each location.','You can retry. Your organizer can also disable the timer.']}),
      spy('processor','The rogue processor','geo_quiz','mission-05-chip-location',{location:'processor',mapLabel:'Pool control cell · Rogue processor',question:'What color is the electric fizz / processor indicator?',options:['Blue','Green','Purple','Red'],answer:settings.howell.fizzAnswer,demoAnswer:'Blue',...fragment(2),completionMessage:'Cooling station activated. Mega AI Chip 01 is now at 80°F.',hints:['Use only the prepared game prop.','Your organizer supplies the colored indicator.','Ask for help if the prop is missing or unclear.']}),
      spy('reveal','Trust STEVE. Always.','continue','mission-06-steve-reveal',{artifact:'Intercepted Agency channel',hints:['STEVE has used your work to gain access. Find the independent Agency signal next.']}),
      spy('countermeasure','The independent signal','audio','mission-06-agency-signal',{narrator:'Agency',answer:settings.howell.shutdownPhrase,artifact:'STEVE override broken',hints:['Open the Journal and read your earned passphrase fragments in order.','Open CipherWave in the Field kit and decode the repeating Agency signal.',`The shutdown phrase is ${settings.howell.shutdownPhrase}.`]}),
      spy('treasure','The final rendezvous','geo_scan','mission-07-final-message',{location:'treasure',mapLabel:'The Enzone · Final rendezvous',token:'HS-FINAL-EZ-8P4R',artifact:'Agency service medal',hints:['The final rendezvous is The Enzone.','Reach the approved treasure spot, then scan its marker.','Ask your organizer where to look without entering private or restricted areas.']})
    ]},
    {id:'pirate',title:'Captain Barnacle Beard',subtitle:'The Lost Treasure',theme:'pirate',location:'Disney’s Vero Beach · route to be supplied',description:'Follow a forgotten chart, recover five lost bearings, and discover what the captain left behind.',narrator:'Captain Barnacle Beard',stages:[
      ...settings.pirate.clues.map((clue,i)=>({id:'clue'+(i+1),title:clue.title,type:'geo_quiz',audio:i===0?'audio/pirate/01-opening.wav':'audio/pirate/02-next-bearing.wav',location:'clue'+(i+1),text:i===0?'Ahoy, explorer! Five bearings stand between ye and my lost treasure. Follow the chart and keep a sharp eye on the world around ye.':'Another bearing awaits. Follow the chart to the next approved stop and inspect the landmark.',question:clue.question || 'DEMO QUESTION: Which symbol belongs on a pirate flag?',options:clue.options.length ? clue.options : ['Skull and crossbones','Traffic light','Snowflake'],answer:clue.answer,demoAnswer:clue.answer || 'Skull and crossbones',artifact:'Chart fragment '+(i+1)+' of 5',hints:['Follow your current destination on the map.','Look for details at the approved landmark.','Ask your organizer for help if the landmark has changed.']})),
      {id:'treasure',title:'X marks the spot',type:'geo_scan',audio:'audio/pirate/03-treasure.wav',location:'treasure',token:'BB-TREASURE',text:'Five bearings recovered! Your chart is complete. Follow the final mark and find the captain’s treasure token.',artifact:'Barnacle Beard’s treasure',hints:['Follow the final destination on your chart.','Find the treasure marker at the organizer’s approved spot.','Ask your organizer if the marker is missing.']}
    ]}
  ];
}

