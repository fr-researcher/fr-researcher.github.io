import {createSimulation, getReference, FLOWS, PAPER, DEFAULT_CONFIG} from './model.js';
import {NEIGHBOR_NETWORKS, getNeighborNetworkStates} from './topology.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const colors = {VO:'#287461', VI:'#426f98', BE:'#866b42'};
const config = {...DEFAULT_CONFIG};
const sim = createSimulation(config);
let snapshot = sim.snapshot(), running = true, speed = 1, activeView = 'lab', selectedVideo = 'sta1', chartService = 'sta4';
let lastFrame = 0, renderAt = 0, sceneTime = 0, previousClassified = false, trafficAnnounced = false;
let log = [], modeChanges = [], samples = [], lastSample = -1;
const fmt = (n,d=1) => Number(n).toLocaleString('en-US',{minimumFractionDigits:d, maximumFractionDigits:d});
const num = n => fmt(n, n>=100?0:n>=10?1:2);
const elapsed = t => `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}.${Math.floor((t%1)*10)}`;
const stationName = id => `STA ${String(Number(id.replace('sta',''))).padStart(2,'0')}`;
const refs = () => Object.fromEntries(getReference(config).map(f=>[f.id,f]));

// Shared coordinates keep each station aligned with its airborne packet path.
const starPositions={
  5:[[150,38],[247,137],[211,310],[89,310],[53,137]],
  6:[[150,38],[247,109],[247,251],[150,322],[53,251],[53,109]],
  7:[[150,38],[247,105],[247,232],[208,322],[92,322],[53,232],[53,105]]
};
const radioCoverage='<div class="radio-coverage" aria-hidden="true"><i></i><i></i></div>';
function networkLinks(stations, attribute){
  return stations.map((station,index)=>{
    const [x,y]=starPositions[stations.length][index];
    return `<g ${attribute}="${station.id}" style="--packet-delay:${-index*.37}s"><path class="air-packets downlink" pathLength="100" d="M150 180L${x} ${y}"/><path class="air-packets uplink" pathLength="100" d="M${x} ${y}L150 180"/></g>`;
  }).join('');
}
function positionStations(container,count){
  container.querySelectorAll('.station').forEach((node,index)=>{
    const [x,y]=starPositions[count][index];
    node.style.setProperty('--station-x',`${x/3}%`);
    node.style.setProperty('--station-y',`${y/3.6}%`);
  });
}
function initializeTopology(){
  $('#moving-wires').innerHTML=networkLinks(FLOWS,'data-flow');
  positionStations($('#home-bss'),FLOWS.length);
  NEIGHBOR_NETWORKS.forEach(network=>{
    const ap=network.id.toUpperCase();
    $(`#${network.id}`).innerHTML=`<header class="bss-heading"><h3 id="${network.id}-title">${ap} · ${network.label}</h3><span>${network.stations.length} stations</span></header><div class="bss-state"></div><p class="bss-timing"></p><div class="bss-diagram">${radioCoverage}<svg class="bss-links" viewBox="0 0 300 360" preserveAspectRatio="none" aria-hidden="true"><g class="moving-wires">${networkLinks(network.stations,'data-neighbor-link')}</g></svg><div class="ap-node"><svg><use href="#i-wifi"/></svg><strong>${ap}</strong><small>Wi-Fi 7</small></div><div class="bss-stations">${network.stations.map(station=>`<div class="station neighbor-station" data-neighbor-station="${station.id}" title="${station.label}: ${station.detail}" tabindex="0"><span class="station-icon"><svg><use href="#i-${station.icon}"/></svg></span><div><small>STA ${String(station.number).padStart(2,'0')}</small><strong>${station.label}</strong><span class="station-stat">${station.detail}</span></div><span class="ac-tag">BE</span></div>`).join('')}</div></div><p class="bss-note">UL: BE; video TCP ACKs inherit VI with QoS-App.</p>`;
    positionStations($(`#${network.id}`),network.stations.length);
  });
}
function renderTopology(){
  const networks=getNeighborNetworkStates(config,snapshot.time),active=networks.filter(network=>network.enabled);
  const traffic=snapshot.time>=PAPER.trafficStart;
  const marked=traffic&&(config.mode==='QoS-App'||snapshot.classifier.applied);
  $('#home-bss').dataset.priority=marked?'on':traffic?'off':'waiting';
  $('#network-mode').textContent=!traffic?'Waiting for traffic':marked?`Prioritizing · ${config.mode}`:config.mode==='QoS-ML'?'Observing · all traffic in BE':'No prioritization · BE';
  $('#home-priority-timing').textContent=config.mode==='QoS-ML'?'5 s observation · earliest marking at t = 7 s':config.mode==='QoS-App'?'Source marking · no observation delay':'All traffic uses AC_BE';
  $('#active-network-count').textContent=`${1+active.length} active ${active.length?'networks':'network'} · ${6+active.reduce((sum,network)=>sum+network.stations.length,0)} stations`;
  $('#neighbor-priority-summary').textContent=!active.length?'No active neighboring networks':config.neighbors!=='QoS'?`${active.map(network=>network.id.toUpperCase()).join(' + ')}: no prioritization · all traffic uses BE`:!traffic?`${active.map(network=>network.id.toUpperCase()).join(' + ')}: QoS-App enabled · starts at t = 2 s`:`${active.map(network=>network.id.toUpperCase()).join(' + ')}: prioritizing since t = 2 s · QoS-App`;
  $('.neighbor-priority-line').classList.toggle('enabled',active.some(network=>network.prioritizing));
  networks.forEach(network=>{
    const container=$(`#${network.id}`);
    container.classList.toggle('network-disabled',!network.enabled);
    container.dataset.priority=!network.enabled?'disabled':network.prioritizing?'on':network.activeTraffic?'off':'waiting';
    container.querySelector('.bss-state').textContent=network.status;
    container.querySelector('.bss-timing').textContent=network.timing||'Select more neighboring networks to include this BSS.';
    container.querySelector('.moving-wires').style.visibility=network.activeTraffic?'visible':'hidden';
    container.querySelector('.bss-note').textContent=!network.enabled?'No channel contention from this network.':config.neighbors==='QoS'?'UL: BE; video TCP ACKs inherit VI with QoS-App.':'Downlink and uplink traffic use AC_BE.';
    network.stations.forEach(station=>{
      const node=container.querySelector(`[data-neighbor-station="${station.id}"]`);
      node.querySelector('.ac-tag').textContent=station.ac;
      node.querySelector('.ac-tag').style.color=colors[station.ac];
      node.style.borderLeftColor=colors[station.ac];
      const packets=container.querySelector(`[data-neighbor-link="${station.id}"]`);
      packets.style.stroke=colors[station.ac];
      packets.querySelector('.uplink').style.stroke=colors[network.prioritizing&&station.icon==='video'?'VI':'BE'];
    });
  });
}

function announce(text) {
  log.unshift({time:Number(snapshot.time.toFixed(2)),text});
  log = log.slice(0,200);
  $('#last-event').textContent = `${elapsed(snapshot.time)} — ${text}`;
  if ($('#log-dialog').open) renderLog();
}
function setView(view){
  activeView=view;
  $$('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
  $$('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.hasAttribute('role'))el.setAttribute('aria-selected',String(el.dataset.view===view));});
  if(view==='compare')renderComparison();
  render();
}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$$('.wordmark,.brand-mark').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();setView('lab');window.scrollTo({top:0,behavior:'smooth'});}));

function updateControls(){
  $$('[data-mode]').forEach(b=>{const active=b.dataset.mode===config.mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $$('[data-obss]').forEach(b=>{const active=Number(b.dataset.obss)===config.obss;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('#neighbor-toggle').classList.toggle('on',config.neighbors==='QoS');
  $('#neighbor-toggle').setAttribute('aria-checked',String(config.neighbors==='QoS'));
  $('#neighbor-toggle').disabled=config.obss===0;
  $('#activate span:not(.button-arrow)').textContent=config.mode==='QoS-ML'?'Return to Best Effort':'Enable QoS-ML';
  const modeText=config.mode==='BE'?'The home network uses BE':config.mode==='QoS-ML'?'The AP classifies and prioritizes flows':'Applications mark traffic at the source';
  $('#scenario-insight').textContent=config.obss===0?'Home only: all three modes meet the reported RTT and video criteria.':config.neighbors==='BE'?'Neighbors use BE. QoS-ML meets all three RTT targets; both videos retain their highest resolution in all modes.':`${modeText} while competing with prioritized traffic from ${config.obss===1?'one neighboring network':'two neighboring networks'}.`;
  renderTopology();
}
function changeMode(mode){
  if(mode===config.mode)return;
  config.mode=mode;
  if(snapshot.complete){restart();return;}
  snapshot=sim.setConfig({mode});
  modeChanges.push({time:snapshot.time,mode});
  announce(mode==='BE'?'BE mode: emulated predictions are retained; downlink packets use AC_BE.':mode==='QoS-ML'?(snapshot.classifier.classified?'QoS-ML enabled: voice → VO; video, video calls and gaming → VI; download → BE.':'QoS-ML enabled: waiting for the first 5 s observation window.'):'QoS-App: source marking; video TCP ACKs use VI.');
  updateControls();render();
}
function restart(message='Session reset. Traffic starts at t = 2 s.'){
  snapshot=sim.reset(config);samples=[];lastSample=-1;modeChanges=[];log=[];sceneTime=0;previousClassified=false;trafficAnnounced=false;running=true;
  updateControls();renderTransport();announce(message);render();
}
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>changeMode(b.dataset.mode)));
$$('[data-obss]').forEach(b=>b.addEventListener('click',()=>{const value=Number(b.dataset.obss);if(value!==config.obss){config.obss=value;restart(`New scenario: ${value?`home + ${value} OBSS`:'home only'}.`);}}));
$('#neighbor-toggle').addEventListener('click',()=>{config.neighbors=config.neighbors==='QoS'?'BE':'QoS';restart(`Neighbors ${config.neighbors==='QoS'?'prioritize their traffic':'use Best Effort'}. Session restarted.`);});
$('#activate').addEventListener('click',()=>changeMode(config.mode==='QoS-ML'?'BE':'QoS-ML'));
$('#reset').addEventListener('click',()=>restart());
function renderTransport(){
  document.body.classList.toggle('paused',!running);$('#live-dot').classList.toggle('paused',!running);
  $('#play').innerHTML=running?'Ⅱ <span>Pause</span>':snapshot.complete?'↻ <span>Replay</span>':'▶ <span>Resume</span>';
  $('#play').setAttribute('aria-label',running?'Pause simulation':snapshot.complete?'Replay simulation':'Resume simulation');
}
$('#play').addEventListener('click',()=>{if(snapshot.complete){restart();return;}running=!running;renderTransport();announce(running?'Simulation resumed.':'Simulation paused.');});
$('#speed').addEventListener('change',e=>{speed=Number(e.target.value);$('#network').style.setProperty('--packet-duration',`${2.8/speed}s`);announce(`Playback speed: ${speed}×. Units still represent simulation time.`);});
$('#video-source').addEventListener('change',e=>{selectedVideo=e.target.value;render();});
$('#chart-service').addEventListener('change',e=>{chartService=e.target.value;renderChart();});
$('#show-log').addEventListener('click',()=>{renderLog();$('#log-dialog').showModal();});
$('#close-log').addEventListener('click',()=>$('#log-dialog').close());
$('#log-dialog').addEventListener('click',e=>{if(e.target===$('#log-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function renderLog(){
  $('#log-entries').replaceChildren(...log.map(entry=>{const row=document.createElement('div');row.className='log-entry';const time=document.createElement('time');time.textContent=elapsed(entry.time);const txt=document.createElement('span');txt.textContent=entry.text;row.append(time,txt);return row;}));
}

function status(id, ok, active=true, words=['Ref. P99: met','Ref. P99: exceeded']){
  const el=$(id);el.textContent=active?(ok?words[0]:words[1]):'Starting';el.classList.toggle('bad',active&&!ok);el.classList.toggle('neutral',!active);
}
function spark(selector, values){
  if(values.length<2){$(selector).innerHTML='';return;}
  const slice=values.slice(-30),min=Math.min(...slice)*.8,max=Math.max(...slice)*1.12;
  const points=slice.map((v,i)=>`${(i/(slice.length-1)*98).toFixed(1)},${(29-(v-min)/(max-min||1)*25).toFixed(1)}`).join(' ');
  $(selector).innerHTML=`<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
}
function render(){
  const s=snapshot, f=Object.fromEntries(s.flows.map(f=>[f.id,f])), active=s.time>=2, reference=refs();
  document.body.classList.toggle('no-traffic',!active);
  $('#clock').textContent=`${elapsed(s.time)} / 01:00`;
  $('#timeline-progress').style.width=`${s.time/60*100}%`;$('#timeline-marker').style.left=`${s.time/60*100}%`;
  $('#class-progress').style.width=`${s.classifier.progress*100}%`;
  $('#classifier-note').textContent=s.classifier.progress<1?`${Math.min(5,Math.max(0,s.time-2)).toFixed(1)} / 5 s observed`:`6 flows · every 1 s`;
  $('#mark-note').textContent=config.mode==='BE'?'Prediction not applied':config.mode==='QoS-App'?'At the source':s.classifier.applied?'Per-application marking':'Awaiting classification';
  $('#ap-caption').textContent=config.mode==='BE'?'No priority marking':config.mode==='QoS-App'?'Priority at the source':s.classifier.applied?'ML classification applied':'Observing flows…';
  renderTopology();
  $$('[data-station]').forEach(el=>{const flow=f[el.dataset.station];el.querySelector('.ac-tag').textContent=flow.ac;el.querySelector('.ac-tag').style.color=colors[flow.ac];el.style.borderColor='#cbd3d9';el.style.borderLeftColor=colors[flow.ac];el.querySelector('.station-stat').textContent=!active?'Awaiting traffic':flow.type==='video'?`${flow.stalled?'Stall':`${flow.resolution}p`} · ${fmt(flow.bufferSeconds)} s`:flow.type==='bulk'?`${fmt(flow.throughput)} Mbit/s`:`RTT ${num(flow.rtt)} ms`;});
  $$('#moving-wires [data-flow]').forEach(group=>{const flow=f[group.dataset.flow];group.style.stroke=colors[flow.ac];group.querySelector('.uplink').style.stroke=colors[config.mode==='QoS-App'&&flow.type==='video'?'VI':'BE'];});
  $('#voice-value').textContent=active?num(f.sta4.rtt):'—';$('#game-value').textContent=active?num(f.sta3.rtt):'—';$('#bulk-value').textContent=active?fmt(f.sta6.throughput):'—';
  status('#voice-status',reference.sta4.meetsTarget,active);status('#game-status',reference.sta3.meetsTarget,active);
  $('#voice-p99').textContent=`P99 ref. ${num(reference.sta4.p99)} ms`;$('#game-p99').textContent=`P99 ref. ${num(reference.sta3.p99)} ms`;$('#bulk-p99').textContent=`P99 ref. ${num(reference.sta6.p99)} ms`;
  $('#voice-status').title='Reported scenario P99 compared with the WLAN RTT target. The live curve illustrates mean RTT and does not determine this result.';$('#game-status').title=$('#voice-status').title;
  const v=f[selectedVideo];
  $('#video-value').textContent=active?(v.stalled?'Stall':`${v.resolution}p`):'—';$('#video-unit').textContent=stationName(selectedVideo);$('#video-buffer').textContent=`${fmt(v.bufferSeconds)} s`;$('#video-rate').textContent=`${fmt(v.throughput)} Mbit/s`;
  status('#video-status',!v.stalled&&v.resolution===v.maxResolution,active,['Top resolution','Reduced / stalled']);
  $$('#quality-bars i').forEach((bar,i)=>bar.classList.toggle('on',active&&!v.stalled&&i<(v.resolution>=1440?5:v.resolution>=1080?4:v.resolution>=720?3:v.resolution>=480?2:1)));
  $('#video-overlay-quality').textContent=active?(v.stalled?'Buffering':`${v.resolution}p · emulated`):'Waiting';
  $('#stall-overlay').hidden=active&&!v.stalled;
  $('#stall-overlay strong').textContent=active?'Playback stalled':'Preparing video';
  $('#stall-overlay small').textContent=active?'Waiting for data in the buffer':'Traffic starts at t = 2 s';
  $('#video-buffer-bar').style.width=`${v.bufferSeconds/9.4*100}%`;$('#video-frame-status').textContent=`Buffer ${fmt(v.bufferSeconds)} s`;
  $('#video-summary').textContent=`Illustrative stall duration: ${fmt(v.stallSeconds)} s`;
  spark('#voice-spark',samples.map(x=>x.flows.sta4.rtt));spark('#game-spark',samples.map(x=>x.flows.sta3.rtt));spark('#bulk-spark',samples.map(x=>x.flows.sta6.throughput));
  renderQueues();
  if(activeView==='lab')renderChart();
}
function renderQueues(){
  const definitions={VO:{name:'Voice',cw:'3 / 7',aifs:2},VI:{name:'Video + gaming',cw:'7 / 15',aifs:2},BE:{name:'Best Effort',cw:'15 / 1023',aifs:3}};
  $('#queues').innerHTML=Object.entries(definitions).map(([ac,d])=>{const q=snapshot.queues[ac],count=q?Math.max(1,Math.min(40,Math.round(Math.log2(q+1)*4))):0;return `<div class="queue-row"><span class="queue-label" style="color:${colors[ac]}">AC_${ac}</span><div class="queue-bar" aria-label="${q} illustrative packets in AC_${ac}">${Array.from({length:count},()=>`<i style="background:${colors[ac]}"></i>`).join('')}</div><span class="queue-count">${q}</span><div class="queue-meta"><span>${d.name}</span><span>CW ${d.cw} · AIFSN ${d.aifs}</span></div></div>`;}).join('');
}
function renderChart(){
  const compact=$('#rtt-chart').clientWidth<440, labelSize=compact?17:10;
  const w=640,h=210,l=compact?65:45,r=compact?24:17,top=22,bottom=28,x=t=>l+t/60*(w-l-r),target=FLOWS.find(f=>f.id===chartService).target;
  const filtered=samples.filter(s=>s.time>=2),max=Math.max(200,...filtered.map(s=>s.flows[chartService].rtt))*1.15;
  const upper=max>2500?10000:max>700?3000:max>220?1000:300;
  const y=v=>top+(1-Math.log10(Math.max(1,v))/Math.log10(upper))*(h-top-bottom);
  const ticks=[1,10,100,1000,10000].filter(v=>v<=upper);
  let html=ticks.map(v=>`<line x1="${l}" y1="${y(v)}" x2="${w-r}" y2="${y(v)}" stroke="#e1e6ea"/><text x="${l-9}" y="${y(v)+3}" text-anchor="end" fill="#657681" stroke="none" font-size="${labelSize}" font-family="var(--sans)">${v}</text>`).join('');
  for(let i=0;i<=60;i+=10)html+=`<text x="${x(i)}" y="${h-8}" text-anchor="middle" fill="#657681" stroke="none" font-size="${labelSize}" font-family="var(--sans)">${i}s</text>`;
  html+=`<line x1="${l}" y1="${y(target)}" x2="${w-r}" y2="${y(target)}" stroke="#82919e" stroke-dasharray="4 5"/><text x="${w-r}" y="${y(target)-6}" text-anchor="end" fill="#536671" stroke="none" font-size="${labelSize}" font-family="var(--sans)">Target ${target} ms</text>`;
  if(filtered.length>1){const coords=filtered.map(s=>`${x(s.time).toFixed(1)},${y(s.flows[chartService].rtt).toFixed(1)}`),last=filtered[filtered.length-1];html+=`<polyline points="${coords.join(' ')}" fill="none" stroke="#2d658f" stroke-width="1.8"/><circle cx="${x(last.time)}" cy="${y(last.flows[chartService].rtt)}" r="3" fill="#2d658f" stroke="#ffffff" stroke-width="2"/>`;}
  modeChanges.forEach((c,i)=>{html+=`<line x1="${x(c.time)}" y1="${top}" x2="${x(c.time)}" y2="${h-bottom}" stroke="#728b9f" stroke-dasharray="2 5" opacity=".55"/><text x="${Math.min(x(c.time)+5,w-60)}" y="${top+8+(i%2)*12}" fill="#728b9f" stroke="none" font-size="${labelSize-1}" font-family="var(--sans)">${c.mode}</text>`;});
  $('#rtt-chart').innerHTML=html;
  $('#chart-insight').textContent=config.mode==='BE'?'The curve illustrates mean RTT. See Reference results for P99 target compliance.':snapshot.classifier.progress<1&&config.mode==='QoS-ML'?'First observation window: flows remain in BE. The P99 label refers to the selected study scenario.':refs()[chartService].meetsTarget?'The reported P99 meets the target. This curve illustrates mean RTT.':'The reported P99 exceeds the target, even if the illustrated mean RTT is lower.';
}

function renderComparison(){
  const modes=['BE','QoS-ML','QoS-App'],r=Object.fromEntries(modes.map(m=>[m,Object.fromEntries(getReference({...config,mode:m}).map(f=>[f.id,f]))]));
  $('#comparison-scenario').innerHTML=`<span>${config.obss?'Home + '+config.obss+' OBSS':'Home only'}</span><span>${config.obss?'Neighbors: '+(config.neighbors==='QoS'?'QoS-App':'Best Effort'):'6 stations'}</span><span>Paper reference values</span>`;
  const descriptions={BE:'All traffic uses AC_BE.', 'QoS-ML':'The AP assigns downlink access categories after observing each flow.', 'QoS-App':'Applications mark traffic at the source.'};
  $('#compare-cards').innerHTML=modes.map(m=>{const met=Object.values(r[m]).filter(f=>f.target!==null&&f.meetsTarget).length;return `<article class="compare-card ${m==='QoS-ML'?'featured':''}"><div class="eyebrow">${m==='BE'?'Baseline':m==='QoS-ML'?'AP classification':'Source marking'}</div><h3>${m==='BE'?'Best Effort':m}</h3><p>${descriptions[m]}</p><div class="compare-score">${met}<small> / 3</small></div><small>Interactive services meeting their P99 target</small></article>`;}).join('');
  const rows=['sta4','sta3','sta2','sta1','sta5','sta6'].flatMap(id=>{
    const f=r.BE[id],tcp=f.type==='video'||f.type==='bulk',name=`${f.name} · ${stationName(id)}`;
    const common={id,name,unit:'ms',target:null};
    const metrics=[{...common,metric:'meanRtt',description:`${tcp?'TCP':'WLAN'} RTT · mean`},{...common,metric:'p99',description:`${tcp?'TCP':'WLAN'} RTT · P99`,target:f.target}];
    if(tcp)metrics.push({id,name,metric:'throughput',description:'Mean downlink IP throughput',unit:'Mbit/s',target:null,encodingRate:f.encodingRate??null});
    return metrics;
  });
  $('#comparison-rows').innerHTML=rows.map(row=>`<tr><td>${row.name}<small>${row.description}</small></td>${modes.map(m=>{const f=r[m][row.id];return `<td class="${row.target?(f[row.metric]<=row.target?'good':'bad'):''}" title="${row.metric==='throughput'?f.source.throughput:f.source.rtt}">${num(f[row.metric])} ${row.unit}</td>`;}).join('')}<td>${row.target?`≤ ${row.target} ms`:row.encodingRate?`≥ ${fmt(row.encodingRate,2)} Mbit/s<small>Encoding-rate criterion</small>`:'—'}</td></tr>`).join('');
}

// Original OWIN6G artwork, animated locally as the emulated video content.
const canvas=$('#video-canvas'),ctx=canvas.getContext('2d'),low=document.createElement('canvas'),lc=low.getContext('2d');
const logoImage=new Image();
const logoLayer=document.createElement('canvas'),logoContext=logoLayer.getContext('2d');
let logoFailed=false,logoReady=false;
logoImage.decoding='async';
logoImage.onload=()=>{
  logoLayer.width=logoImage.naturalWidth;logoLayer.height=logoImage.naturalHeight;
  logoContext.drawImage(logoImage,0,0);
  // Tint the original alpha mask at render time; preserve the official artwork's geometry.
  logoContext.globalCompositeOperation='source-in';
  logoContext.fillStyle='#03512e';logoContext.fillRect(0,0,logoLayer.width,logoLayer.height);
  logoContext.globalCompositeOperation='source-over';logoReady=true;
};
logoImage.onerror=()=>{logoFailed=true;};
logoImage.src='assets/owin6g-logo.png';
function reflectMotion(distance,span){
  if(span<=0)return 0;
  const phase=distance%(span*2);
  return phase<=span?phase:span*2-phase;
}
function renderScene(){
  if(activeView!=='lab')return;
  const f=snapshot.flows.find(f=>f.id===selectedVideo),rect=canvas.getBoundingClientRect();if(!rect.width)return;
  const dpr=Math.min(window.devicePixelRatio||1,2),cw=Math.round(rect.width*dpr),ch=Math.round(rect.height*dpr);
  if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
  const ratio=f.resolution>=1440?1:f.resolution>=1080?.6:f.resolution>=720?.3:f.resolution>=480?.15:.085;
  const W=Math.max(45,Math.round(cw*ratio)),H=Math.max(25,Math.round(ch*ratio));
  if(low.width!==W||low.height!==H){low.width=W;low.height=H;}
  lc.setTransform(W/rect.width,0,0,H/rect.height,0,0);
  lc.fillStyle='#ffffff';lc.fillRect(0,0,rect.width,rect.height);
  if(logoReady){
    const width=Math.min(rect.width*.62,360),height=width*logoImage.naturalHeight/logoImage.naturalWidth;
    const margin=22,top=58,bottom=52;
    const x=margin+reflectMotion(sceneTime*34,rect.width-width-margin*2);
    const y=top+reflectMotion(sceneTime*22,rect.height-height-top-bottom);
    // sceneTime advances only while the selected stream plays: stalls freeze the logo.
    lc.drawImage(logoLayer,x,y,width,height);
    canvas.dataset.artwork='loaded';
    canvas.dataset.motionTime=sceneTime.toFixed(3);
    canvas.dataset.renderWidth=String(W);
  }else{
    lc.fillStyle='#42634d';lc.font='13px Aptos, "Segoe UI", Arial, sans-serif';lc.textAlign='center';
    lc.fillText(logoFailed?'OWIN6G artwork could not be loaded.':'Loading OWIN6G artwork…',rect.width/2,rect.height/2);
    canvas.dataset.artwork=logoFailed?'error':'loading';
  }
  ctx.imageSmoothingEnabled=f.resolution>=720;ctx.drawImage(low,0,0,cw,ch);
}

function frame(now){
  const dt=lastFrame?Math.min((now-lastFrame)/1000,.15):0;lastFrame=now;
  if(running){snapshot=sim.step(dt*speed);const video=snapshot.flows.find(f=>f.id===selectedVideo);if(snapshot.time>=2&&!video.stalled)sceneTime+=dt*speed;
    if(snapshot.time>=2&&!trafficAnnounced){trafficAnnounced=true;announce('Traffic starts in all active networks. The first AP1 observation window is open.');}
    if(snapshot.classifier.classified&&!previousClassified){previousClassified=true;announce(config.mode==='BE'?'First emulated classification. In BE, predictions are recorded but not applied.':config.mode==='QoS-ML'?'First emulated classification: voice → VO; video, video calls and gaming → VI.':'First emulated classification recorded. QoS-App already marks traffic at the source.');}
    if(snapshot.time-lastSample>=.25){lastSample=snapshot.time;samples.push({time:Number(snapshot.time.toFixed(3)),mode:config.mode,flows:Object.fromEntries(snapshot.flows.map(f=>[f.id,{rtt:f.rtt,throughput:f.throughput,ac:f.ac,bufferSeconds:f.bufferSeconds,resolution:f.resolution,stalled:f.stalled}]))});}
    if(snapshot.complete){running=false;renderTransport();announce('60 s emulation complete. Replay or change the scenario.');}
  }
  if(now-renderAt>120){render();renderAt=now;}
  renderScene();requestAnimationFrame(frame);
}
initializeTopology();updateControls();renderTransport();announce('Initial scenario: AP2 and AP3 use QoS-App from the first packet at t = 2 s.');render();requestAnimationFrame(frame);
