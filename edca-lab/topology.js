import {DEFAULT_CONFIG, PAPER} from './model.js?v=20261007-paper-check';

// Station mix from the draft's three-WLAN scenario. These are topology and
// marking states, not additional measured or simulated neighbor performance.
// Data directions follow Figure 4; video uplink includes TCP acknowledgments.
export const NEIGHBOR_NETWORKS = Object.freeze([
  {
    id:'ap2', ordinal:1, label:'Neighbor 1',
    stations:[
      {id:'sta7', number:7, label:'4K video', detail:'2160p stream', icon:'video', priorityAc:'VI', downlink:true, uplink:true},
      {id:'sta8', number:8, label:'4K cameras', detail:'UDP · 40 Mbit/s DL', icon:'camera', priorityAc:'BE', downlink:true, uplink:false},
      {id:'sta9', number:9, label:'Gaming', detail:'Interactive game', icon:'game', priorityAc:'VI', downlink:true, uplink:true},
      {id:'sta10', number:10, label:'Video call', detail:'8 / 4 Mbit/s DL / UL', icon:'users', priorityAc:'VI', downlink:true, uplink:true},
      {id:'sta11', number:11, label:'Voice', detail:'VoIP', icon:'phone', priorityAc:'VO', downlink:true, uplink:true},
      {id:'sta12', number:12, label:'Web', detail:'Bursty UDP · 5 Mbit/s DL', icon:'globe', priorityAc:'BE', downlink:true, uplink:false},
      {id:'sta13', number:13, label:'IoT', detail:'Bursty UDP · 3 Mbit/s UL', icon:'chip', priorityAc:'BE', downlink:false, uplink:true}
    ]
  },
  {
    id:'ap3', ordinal:2, label:'Neighbor 2',
    stations:[
      {id:'sta14', number:14, label:'1440p video', detail:'1440p stream', icon:'video', priorityAc:'VI', downlink:true, uplink:true},
      {id:'sta15', number:15, label:'4K cameras', detail:'UDP · 30 Mbit/s DL', icon:'camera', priorityAc:'BE', downlink:true, uplink:false},
      {id:'sta16', number:16, label:'Video call', detail:'8 / 4 Mbit/s DL / UL', icon:'users', priorityAc:'VI', downlink:true, uplink:true},
      {id:'sta17', number:17, label:'Voice', detail:'VoIP', icon:'phone', priorityAc:'VO', downlink:true, uplink:true},
      {id:'sta18', number:18, label:'IoT', detail:'Bursty UDP · 2 Mbit/s UL', icon:'chip', priorityAc:'BE', downlink:false, uplink:true}
    ]
  }
].map(network=>Object.freeze({
  ...network,
  stations:Object.freeze(network.stations.map(station=>Object.freeze(station)))
})));

/** Neighbor source marking starts with traffic, independently of home ML. */
export function getNeighborNetworkStates(config=DEFAULT_CONFIG, time=0){
  const {obss=DEFAULT_CONFIG.obss, neighbors=DEFAULT_CONFIG.neighbors}=config;
  return NEIGHBOR_NETWORKS.map(network=>{
    const enabled=network.ordinal<=obss;
    const activeTraffic=enabled&&time>=PAPER.trafficStart;
    const prioritizing=activeTraffic&&neighbors==='QoS';
    return {
      ...network,
      enabled,
      activeTraffic,
      prioritizing,
      status:!enabled?'Not in this scenario':!activeTraffic?'Waiting for traffic':prioritizing?'Prioritizing · QoS-App':'No prioritization · BE',
      timing:!enabled?'':neighbors==='QoS'?`QoS-App from first packet · t = ${PAPER.trafficStart} s`:'All traffic uses AC_BE',
      stations:network.stations.map(station=>({...station,ac:prioritizing?station.priorityAc:'BE'}))
    };
  });
}
