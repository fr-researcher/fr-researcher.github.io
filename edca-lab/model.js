/**
 * AP Lab — educational surrogate, not an ns-3 or XGBoost implementation.
 * Static anchors transcribed from the supplied draft's figure legends.
 * Transients, queues, packets, buffers and animation time are illustrative.
 */
export const FLOWS = Object.freeze([
  {id:'sta1',sta:1,name:'4K video',type:'video',application:'Video Streaming',ac:'VI',maxResolution:2160,encodingRate:16.88,offeredRate:16.88,target:null},
  {id:'sta2',sta:2,name:'Video call',type:'conference',application:'Video Conference',ac:'VI',maxResolution:null,offeredRate:8,uplinkRate:4,target:100},
  {id:'sta3',sta:3,name:'Gaming',type:'gaming',application:'Gaming',ac:'VI',maxResolution:null,offeredRate:.11,uplinkRate:.11,target:20},
  {id:'sta4',sta:4,name:'Voice',type:'voice',application:'VoIP',ac:'VO',maxResolution:null,offeredRate:.10,uplinkRate:.10,target:100},
  {id:'sta5',sta:5,name:'1440p video',type:'video',application:'Video Streaming',ac:'VI',maxResolution:1440,encodingRate:8.44,offeredRate:8.44,target:null},
  {id:'sta6',sta:6,name:'TCP download',type:'bulk',application:'Bulk_TCP',ac:'BE',maxResolution:null,offeredRate:50,target:null}
].map(Object.freeze));

export const PAPER = Object.freeze({
  title:'Enabling EDCA through machine learning at the access point in IEEE 802.11be WLANs',
  window:5,step:1,trafficStart:2,metricsStart:7,duration:60,segmentSeconds:2,fullBufferSeconds:9.4,
  videoSteadyIpMbps:Object.freeze({2160:18.53,1440:9.27}),
  phy:{standard:'IEEE 802.11be',bandGHz:5,channelMHz:160,mcs:5,nss:1,giNs:800,rateMbps:576.5},
  edca:{VO:{cwMin:3,cwMax:7,aifsn:2,txopUs:2080},VI:{cwMin:7,cwMax:15,aifsn:2,txopUs:4096},BE:{cwMin:15,cwMax:1023,aifsn:3,txopUs:2528},BK:{cwMin:15,cwMax:1023,aifsn:7,txopUs:null}},
  targets:{voice:100,conference:100,gaming:20},
  accuracy:{testPercent:99.6,baseWindows:4860,baseAcErrors:0,coexistenceAcErrors:0},
  sources:{udp:'Figures 9 and 13 · pages 12 and 15',tcp:'Figures 10 and 14 · pages 13 and 16',throughput:'Figures 11 and 15 · pages 14 and 16',video:'Figures 12 and 16 · pages 14 and 17',configuration:'Table 5 · pages 6–7',targets:'Table 6 · page 8'},
  statistics:{seeds:5,measurementStartSeconds:7,meanRtt:'Mean of the five per-seed means',p99Rtt:'99th percentile of RTT samples pooled across five seeds',tcpThroughput:'Mean across five seeds, from t = 7 s to the last received packet',precision:'Rounded labels transcribed from the draft figures'},
  notes:[
    'Illustrative browser model based on the draft; it does not run ns-3 or a trained XGBoost classifier.',
    'Reference values are rounded results reported in the draft. The animated values and video trajectories are synthetic.',
    'The RTT curve illustrates changes around reported mean RTT values. It is not a packet trace, empirical CDF or measured P99.',
    'Mode changes during a session illustrate a transition. The study compares separate runs with fixed modes.',
    'Lossless channel, no hidden nodes and a single contention domain. OBSS adds contention, not propagation losses.',
    'All modes use the same scheduler with Trigger Frames. Prioritization comes from downlink marking.',
    'In QoS-App, video TCP ACKs use VI; all other uplink traffic remains BE. QoS-App is not a strict upper bound.',
    'The 99.6% accuracy comes from the classifier test set. The paper\'s simulation runs did not assign any incorrect ACs.',
    'The reference P99 uses pooled RTT samples across five random seeds. Mean RTT is the mean of the five per-seed means.',
    'Lower video representations, queue sizes, channel occupancy and the animated frame sequence are illustrative.',
    'Video buffer seconds and stalls are scripted illustrations, not a DASH segment simulation. Buffered Mbit is not computed without per-segment history.',
    'Live video throughput uses the steady IP rates described on page 8 with illustrative refill transients; it is not the paper\'s centered 5-second average across five seeds.',
    'UDP throughput is not reported in the draft; its live display is an estimate based on configured offered load.'
  ]
});

export const DEFAULT_CONFIG = Object.freeze({mode:'BE',obss:2,neighbors:'QoS'});
const MODES=['BE','QoS-ML','QoS-App'];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const lerp=(a,b,t)=>a+(b-a)*t;

// Each row is [mean RTT, P99 RTT] in milliseconds; flow order is FLOWS.
const RTT={
  'BE-0':{
    BE:[[10.6,28],[4.27,73.1],[1.41,8.15],[1.35,9.37],[14.4,41.3],[1.96,15.9]],
    'QoS-ML':[[10.1,37.5],[1.57,22.1],[1.23,6.06],[.94,5.89],[10.5,31],[14.6,72.6]],
    'QoS-App':[[9.99,31.1],[1.72,27],[1.23,6],[.98,6.45],[11.6,41.4],[14.7,72.9]]
  },
  'BE-1':{
    BE:[[24.3,95.4],[19.7,131],[8.08,58.3],[8.41,59.4],[32,122],[17.9,118]],
    'QoS-ML':[[10.7,42.2],[2.09,26],[1.64,9.02],[1.16,7.28],[11.1,40.2],[44,214]],
    'QoS-App':[[11,37.6],[2.52,37.6],[1.73,9.98],[1.28,8.8],[12.1,51],[50.3,239]]
  },
  'BE-2':{
    BE:[[46.3,223],[62.4,307],[29.9,250],[30.2,260],[63,284],[56.8,294]],
    'QoS-ML':[[12.1,47.2],[3.27,41.4],[2.39,14.3],[1.46,9.16],[12.5,43.3],[111,480]],
    'QoS-App':[[12.3,41.3],[3.51,44.6],[2.48,15.1],[1.58,11.4],[14.9,61.5],[114,527]]
  },
  'QoS-1':{
    BE:[[213,932],[294,1614],[244,2341],[312,2318],[377,1586],[418,1486]],
    'QoS-ML':[[18.2,68.6],[9.21,78.8],[7.32,39],[3.43,18],[19.5,80.3],[233,895]],
    'QoS-App':[[23.3,87],[12,103],[7.75,42.5],[3.45,18.3],[25.6,107],[228,841]]
  },
  'QoS-2':{
    BE:[[306,1304],[1152,6364],[1174,5601],[1128,5459],[336,2048],[593,2885]],
    'QoS-ML':[[27.9,105],[20.7,116],[16.4,79],[6.3,31.4],[31.9,127],[265,1220]],
    'QoS-App':[[37.2,133],[28.9,141],[16.9,81.4],[6.34,32.3],[44,177],[261,1199]]
  }
};
// TCP downlink throughput [STA1, STA5, STA6] in Mbit/s, exact printed labels.
const TCP_RATE={
  'BE-0':{BE:[18.6,9.3,49.2],'QoS-ML':[18.6,9.3,49.2],'QoS-App':[18.5,9.3,49.2]},
  'BE-1':{BE:[18.8,9.4,49.3],'QoS-ML':[18.7,9.2,48.9],'QoS-App':[18.7,9.4,49.2]},
  'BE-2':{BE:[19.6,9.2,49],'QoS-ML':[18.6,9.2,41.3],'QoS-App':[18.4,9.4,42.8]},
  'QoS-1':{BE:[6.4,2.5,9.2],'QoS-ML':[20.8,9.6,16.3],'QoS-App':[18.8,9.4,15]},
  'QoS-2':{BE:[1.2,.25,1.9],'QoS-ML':[19.8,9.9,4.3],'QoS-App':[18.8,9.3,4.5]}
};

function validConfig(input={}){
  const c={...DEFAULT_CONFIG,...input};
  if(!MODES.includes(c.mode))throw new RangeError('Unknown mode');
  if(![0,1,2].includes(c.obss))throw new RangeError('OBSS must be 0, 1 or 2');
  if(!['BE','QoS'].includes(c.neighbors))throw new RangeError('Neighbors must be BE or QoS');
  return {mode:c.mode,obss:c.obss,neighbors:c.neighbors};
}

export function getReference(input={}){
  const c=validConfig(input),key=`${c.obss?c.neighbors:'BE'}-${c.obss}`;
  return FLOWS.map((f,i)=>{
    const [meanRtt,p99]=RTT[key][c.mode][i];
    const tcpIndex=f.id==='sta1'?0:f.id==='sta5'?1:f.id==='sta6'?2:-1;
    const throughput=tcpIndex<0?null:TCP_RATE[key][c.mode][tcpIndex];
    const qosNeighbors=c.obss>0&&c.neighbors==='QoS';
    return {...f,mode:c.mode,obss:c.obss,neighbors:c.neighbors,meanRtt,rtt:meanRtt,p99,p99Rtt:p99,throughput,
      meetsTarget:f.target===null?null:p99<=f.target,
      quality:{meanRtt:'reported',p99:'reported',p99Rtt:'reported',throughput:tcpIndex<0?'not-reported':'reported'},
      source:{rtt:tcpIndex<0?(qosNeighbors?'Figure 13 · page 15':'Figure 9 · page 12'):(qosNeighbors?'Figure 14 · page 16':'Figure 10 · page 13'),throughput:tcpIndex<0?'No UDP throughput result reported':qosNeighbors?'Figure 15 · page 16':'Figure 11 · page 14'}
    };
  });
}

const rank={BE:0,VI:1,VO:2};
const stageNames=['contention','rts-cts','downlink','block-ack','trigger','uplink','ul-block-ack','cf-end'];

export function createSimulation(initial={}){
  let config=validConfig(initial),time=0,flows=[],history=[],lastInference=null,events=[],qosSince=null;
  let txopCount=0,triggerCount=0,emulatedPackets=0,lastCycle=-1,activeTxop=null;

  function initialize(){
    time=0;history=[];lastInference=null;events=[];qosSince=config.mode==='QoS-App'?2:null;
    txopCount=0;triggerCount=0;emulatedPackets=0;lastCycle=-1;activeTxop=null;
    flows=FLOWS.map(f=>({...f,active:true,ac:config.mode==='QoS-App'?f.ac:'BE',dscp:null,classLabel:null,
      observationStart:null,lastActive:null,classifiedAt:null,classificationCount:0,abstaining:false,
      rtt:0,p99:0,throughput:0,queuePackets:0,bufferSeconds:0,resolution:f.maxResolution||null,
      stalled:false,started:false,playbackTime:0,stallSeconds:0,deliveredMbit:0,uplinkAc:config.mode==='QoS-App'&&f.type==='video'?'VI':'BE'}));
    applyMarking();
  }
  initialize();

  function applyMarking(){
    for(const f of flows){
      const classAc=f.type==='voice'?'VO':f.type==='bulk'?'BE':'VI';
      f.ac=config.mode==='QoS-App'||(config.mode==='QoS-ML'&&f.classifiedAt!==null)?classAc:'BE';
      f.dscp=f.ac==='BE'?null:`${f.ac} marking`;
      f.uplinkAc=config.mode==='QoS-App'&&f.type==='video'?'VI':'BE';
    }
  }

  function classify(){
    if(time<7-1e-7)return;
    const tick=Math.floor(time+1e-7);
    if(tick===lastInference)return;
    lastInference=tick;
    for(const f of flows){
      if(f.observationStart===null||time-f.observationStart<5-1e-6)continue;
      f.abstaining=!f.active||f.lastActive===null||time-f.lastActive>=1;
      if(f.abstaining)continue;
      f.classLabel=f.application;f.classifiedAt??=tick;f.classificationCount++;
      if(f.classificationCount===1)events.unshift({time:tick,type:'classification',text:`STA${f.sta}: ${f.application} → AC_${f.type==='voice'?'VO':f.type==='bulk'?'BE':'VI'}`});
    }
    events=events.slice(0,12);
  }

  function videoTarget(f,effective){
    const crowded=config.obss>0&&config.neighbors==='QoS';
    const prioritized=effective!=='BE';
    if(!crowded){
      const fillDuration=config.mode==='QoS-App'?2:config.obss===2?8:config.obss===1?3:2;
      const fill=clamp((time-2)/fillDuration,0,1);
      // Figure 12: with two BE neighbors, classification accelerates filling.
      // These smooth curves illustrate the ordering, not sampled buffer traces.
      const classifiedRecovery=effective==='QoS-ML'&&config.obss===2;
      return {resolution:f.maxResolution,buffer:classifiedRecovery?9.4:9.4*fill,stalled:false,responseSeconds:classifiedRecovery?.25:.2};
    }
    if(prioritized){
      const elapsed=time-(qosSince??time)+1e-7;
      if(config.mode==='QoS-App')return {resolution:f.maxResolution,buffer:9.4,stalled:false,responseSeconds:.55};
      // Figure 16: STA1 resumes its top representation near t = 8 s;
      // STA5 recovers gradually, reaching 1440p near t = 15 s.
      // The timing and intermediate buffer levels remain illustrative.
      const resolution=f.id==='sta1'?f.maxResolution:elapsed<3?480:elapsed<5?720:elapsed<8?1080:f.maxResolution;
      const stalled=f.id==='sta1'&&elapsed<1&&f.bufferSeconds<.6;
      return {resolution,buffer:stalled?0:9.4,stalled,responseSeconds:1.2};
    }
    if(config.mode==='QoS-ML'||time<5){
      // Figure 16: both BE and ML initially play STA1 at 2160p and STA5
      // at 480p before interruptions near 5 s. ML then recovers sooner.
      const stalled=time>=5&&(f.id==='sta1'||config.obss===2);
      const buffer=stalled?0:f.id==='sta5'&&config.obss===1?.5+.2*(time-2):Math.max(.3,3-(time-2));
      return {resolution:f.id==='sta1'?f.maxResolution:480,buffer,stalled,responseSeconds:.3};
    }
    if(config.obss===1){
      const resolution=f.id==='sta1'?(time<12?480:time>=34&&time<36?1440:Math.sin(time*.23)>-.35?1080:720):480;
      const stalled=f.id==='sta1'&&time>5&&time<12&&Math.sin(time*2.7)>-.2;
      return {resolution,buffer:stalled?0:Math.min(9.4,Math.max(.4,(time-5)*.3)),stalled};
    }
    const stalled=f.id==='sta1'?(time<30||Math.sin(time*.9)>.1):Math.sin(time*1.07)>.05;
    return {resolution:f.id==='sta1'&&Math.sin(time*.37)>.5?480:360,buffer:stalled?0:.8,stalled};
  }

  function tick(dt){
    time=Math.min(60,time+dt);
    for(const f of flows){
      if(time>=2-1e-7&&f.active){f.observationStart??=Math.max(2,time-dt);f.lastActive=time;}
    }
    classify();
    applyMarking();
    if(config.mode==='QoS-ML'&&flows.some(f=>f.classifiedAt!==null))qosSince??=time;
    const effective=config.mode==='QoS-ML'&&!flows.some(f=>f.classifiedAt!==null)?'BE':config.mode;
    const refs=getReference({...config,mode:effective});
    const alpha=1-Math.exp(-dt/1.15);
    flows.forEach((f,i)=>{
      const isLive=time>=2-1e-7&&f.active,ref=refs[i];
      const variation=1+.08*Math.sin(time*1.37+i*1.19)+.035*Math.sin(time*4.3+i);
      const meanTarget=isLive?ref.meanRtt*variation:0;
      f.rtt=lerp(f.rtt,meanTarget,alpha);
      f.p99=lerp(f.p99,isLive?ref.p99:0,alpha);
      f.p99Rtt=f.p99;f.meanRtt=f.rtt;
      // UDP delivery is illustrative; only TCP throughput is reported in the paper.
      // Figure means include startup/refill. They are not steady-state rates.
      // Page 8 gives stable IP delivery of 18.53 / 9.27 Mbit/s; Figure 16
      // shows ML converging to App after recovery. Keep printed means in refs.
      const degradedVideo=f.type==='video'&&effective==='BE'&&config.obss>0&&config.neighbors==='QoS';
      const steadyRate=f.type==='video'&&!degradedVideo?PAPER.videoSteadyIpMbps[f.maxResolution]:(ref.throughput??f.offeredRate);
      let targetRate=isLive?steadyRate*(1+.04*Math.sin(time*2.1+i)):0;
      if(f.type==='video'&&isLive){
        const v=videoTarget(f,effective);
        f.resolution=v.resolution;
        const recovery=effective!=='BE'&&f.bufferSeconds<8.5;
        // Reference values are IP-layer throughput, including protocol headers.
        // This refill multiplier illustrates bursts; segments are not simulated.
        if(recovery)targetRate*=1.5;
        const bufferAlpha=1-Math.exp(-dt/(v.responseSeconds??(recovery?1.8:1.0)));
        f.bufferSeconds=clamp(lerp(f.bufferSeconds,v.buffer,bufferAlpha),0,9.4);
        f.stalled=v.stalled;
        if(f.stalled)f.bufferSeconds=0;
        f.started=true;
        if(f.stalled)f.stallSeconds+=dt;else f.playbackTime+=dt;
      }else if(f.type==='video'&&!isLive){
        if(time>=2){f.bufferSeconds=Math.max(0,f.bufferSeconds-dt);f.stalled=f.bufferSeconds===0;}
      }
      f.throughput=lerp(f.throughput,targetRate,alpha);
      f.deliveredMbit+=f.throughput*dt;
      f.queuePackets=isLive?Math.round(clamp((f.rtt/1000)*(f.offeredRate*1e6/12000)*.6+2*Math.sin(time+i)**2,0,4096)):0;
      f.meetsTarget=f.target===null?null:f.p99<=f.target;
      f.reference=ref;
    });
    const cycle=Math.floor(Math.max(0,time-2)/1.8);
    if(time>=2&&cycle!==lastCycle){lastCycle=cycle;activeTxop=selectTxop(cycle);txopCount++;triggerCount++;}
    emulatedPackets+=flows.reduce((s,f)=>s+f.throughput*1e6/12000*dt,0);
    if(!history.length||time-history[history.length-1].time>=.45){
      history.push({time,voice:flows[3].rtt,gaming:flows[2].rtt,conference:flows[1].rtt,video:flows[0].throughput,bulk:flows[5].throughput});
      if(history.length>150)history.shift();
    }
  }

  function selectTxop(cycle){
    const available=flows.filter(f=>f.active);
    const order=config.mode==='BE'?['BE']:['VO','VI','VI','BE','VI','VO'];
    const requested=order[cycle%order.length];
    const wonAc=available.some(f=>f.ac===requested)?requested:(available.sort((a,b)=>rank[b.ac]-rank[a.ac])[0]?.ac||'BE');
    const eligible=flows.filter(f=>f.active&&f.ac===wonAc).sort((a,b)=>b.queuePackets-a.queuePackets);
    const dl=eligible[0]||flows[0],ul=flows[(dl.sta+4)%6];
    return {wonAc,dlSta:dl.id,ulSta:ul.id,limitUs:PAPER.edca[wonAc].txopUs};
  }

  function getTxop(){
    if(time<2)return {stage:'idle',wonAc:'BE',dlSta:'sta1',ulSta:'sta6',limitUs:2528,progress:0,firstEligibility:'AC = AC_won',nextEligibility:'AC ≥ AC_won',ulEligibility:'AC ≥ BE',triggerEnabled:true};
    const progress=((time-2)%1.8)/1.8;
    // Keep the winner and paired stations fixed until this TXOP finishes.
    return {...activeTxop,stage:stageNames[Math.min(stageNames.length-1,Math.floor(progress*stageNames.length))],
      progress,firstEligibility:'AC = AC_won',nextEligibility:'AC ≥ AC_won',ulEligibility:'AC ≥ BE',triggerEnabled:true,
      firstSelection:'LQF',nextSelection:'round-robin',illustrativeTimeScale:true};
  }

  function snapshot(){
    const queues={VO:0,VI:0,BE:0};for(const f of flows)queues[f.ac]+=f.queuePackets;
    const classified=flows.filter(f=>f.classifiedAt!==null).length;
    const progress=clamp((time-2)/5,0,1),live=flows.some(f=>f.active)&&time>=2;
    const desiredReference=getReference(config);
    return {time,config:{...config},mode:config.mode,obss:config.obss,neighbors:config.neighbors,complete:time>=60,
      classifier:{progress,window:5,step:1,lastInference,classified,phase:time<2?'idle':progress<1?'observing':config.mode==='BE'?'open-loop':'classified',applied:config.mode==='QoS-ML'&&classified>0,accuracyIsSimulation:false,nextInference:time<7?7:Math.floor(time)+1},
      flows:flows.map((f,i)=>({...f,reference:desiredReference[i],emulated:true})),queues,txop:getTxop(),
      totals:{throughput:flows.reduce((s,f)=>s+f.throughput,0),queuePackets:flows.reduce((s,f)=>s+f.queuePackets,0),
        txops:txopCount,triggers:triggerCount,packets:Math.round(emulatedPackets),
        channelBusy:live?clamp([.41,.74,.96][config.obss]+.025*Math.sin(time),0,1):0,
        targetMet:desiredReference.filter(f=>f.meetsTarget===true).length,targetCount:3,targetBasis:'draft-reference-p99',emulated:true},
      reference:desiredReference,history:history.map(h=>({...h})),events:events.map(e=>({...e})),
      assumptions:PAPER.notes,metricStatus:time<7?'warm-up':'emulated'};
  }

  return {
    step(dt=.1){
      if(!Number.isFinite(dt)||dt<0)throw new RangeError('dt must be finite and nonnegative');
      let remaining=Math.min(dt,PAPER.duration-time);
      while(remaining>1e-9){const sub=Math.min(.1,remaining);tick(sub);remaining-=sub;}
      // Frame-sized increments can land a few floating-point units below 60.
      if(PAPER.duration-time<=1e-9)time=PAPER.duration;
      return snapshot();
    },
    snapshot,
    setConfig(partial){
      const next=validConfig({...config,...partial});
      if(next.mode!==config.mode){
        const alreadyPrioritized=config.mode==='QoS-App'||config.mode==='QoS-ML'&&flows.some(f=>f.classifiedAt!==null);
        const willPrioritize=next.mode==='QoS-App'||next.mode==='QoS-ML'&&flows.some(f=>f.classifiedAt!==null);
        qosSince=willPrioritize?(alreadyPrioritized?qosSince??Math.max(2,time):Math.max(2,time)):null;
        events.unshift({time,type:'mode',text:`Mode ${next.mode}`});
      }
      config=next;applyMarking();return snapshot();
    },
    setFlowActive(id,active){const f=flows.find(f=>f.id===id);if(!f)throw new RangeError('Unknown flow');f.active=Boolean(active);return snapshot();},
    reset(next){if(next)config=validConfig({...config,...next});initialize();return snapshot();}
  };
}
