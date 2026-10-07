import assert from 'node:assert/strict';
import {createSimulation, getReference} from '../model.js';
import {buildVideoLiveState, renderVideoLiveChart} from '../video-live.js';
import {NEIGHBOR_NETWORKS} from '../topology.js';

// Figure 16(a,c,d): an initial playback interval precedes the BE degradation.
for (const obss of [1, 2]) {
  const sim = createSimulation({mode:'BE', obss, neighbors:'QoS'});
  const start = sim.step(3);
  assert.equal(start.flows[0].resolution, 2160);
  assert.equal(start.flows[4].resolution, 480);
  assert.ok(start.flows.filter(f => f.type === 'video').every(f => !f.stalled));
  if (obss === 2) {
    assert.equal(sim.step(3).flows[0].stalled, true);
    assert.equal(sim.step(23).flows[0].stalled, true);
  } else {
    const degraded = sim.step(20).flows[0];
    assert.ok([720,1080].includes(degraded.resolution));
    assert.equal(degraded.stalled, false);
    assert.equal(sim.step(12).flows[0].resolution, 1440);
  }
}

// Figure 16: temporary observation-period stalls followed by full recovery.
for (const obss of [1, 2]) {
  const sim = createSimulation({mode:'QoS-ML', obss, neighbors:'QoS'});
  let state = sim.step(5.5);
  assert.equal(state.flows[0].stalled, true);
  assert.equal(state.flows[4].stalled, obss === 2);
  state = sim.step(3);
  assert.equal(state.flows[0].resolution, 2160);
  assert.equal(state.flows[0].stalled, false);
  assert.ok(state.flows[4].resolution < 1440);
  state = sim.step(7);
  assert.equal(state.flows[4].resolution, 1440);
  assert.equal(state.flows[4].stalled, false);

  // Page 17: recovered ML and App delivery converge. Figure 15 means differ
  // because they include the refill transient; preserve those printed values.
  const app = createSimulation({mode:'QoS-App', obss, neighbors:'QoS'});
  const recovered = sim.step(44.5);
  const marked = app.step(60);
  for (const i of [0,4]) {
    assert.ok(Math.abs(recovered.flows[i].throughput - marked.flows[i].throughput) < .01);
    assert.ok(Math.abs(recovered.flows[i].bufferSeconds - marked.flows[i].bufferSeconds) < .01);
  }
}
assert.deepEqual(getReference({mode:'QoS-ML',obss:1,neighbors:'QoS'}).filter(f=>f.type==='video').map(f=>f.throughput),[20.8,9.6]);
assert.deepEqual(getReference({mode:'QoS-ML',obss:2,neighbors:'QoS'}).filter(f=>f.type==='video').map(f=>f.throughput),[19.8,9.9]);

// Playback invariants and valid chart geometry across all offered controls.
for (const mode of ['BE','QoS-ML','QoS-App']) for (const obss of [0,1,2]) for (const neighbors of ['BE','QoS']) {
  const config = {mode,obss,neighbors}, sim = createSimulation(config), samples = [];
  for (let t=0; t<240; t++) {
    const snapshot = sim.step(.25);
    samples.push({time:snapshot.time,flows:Object.fromEntries(snapshot.flows.map(f=>[f.id,f]))});
    for (const flow of snapshot.flows.filter(f=>f.type==='video')) {
      assert.ok(Number.isFinite(flow.throughput) && flow.throughput >= 0);
      assert.ok(flow.bufferSeconds >= 0 && flow.bufferSeconds <= 9.4);
      assert.equal('bufferMbit' in flow, false, 'No false Mbit conversion without segment history');
      if (snapshot.time >= 2 && (mode==='QoS-App'||neighbors==='BE'||obss===0)) {
        assert.equal(flow.stalled,false);
        assert.equal(flow.resolution,flow.maxResolution);
      }
      const state = buildVideoLiveState({snapshot,samples,selectedVideo:flow.id,config});
      assert.ok(state.points.every(p=>p.time<=snapshot.time));
      for (const kind of ['resolution','throughput','buffer']) assert.doesNotMatch(renderVideoLiveChart(kind,state),/NaN|Infinity/);
    }
  }
}

// Figure 4: directional UDP traffic must not acquire a reverse data stream.
const stations = NEIGHBOR_NETWORKS.flatMap(n=>n.stations);
assert.deepEqual(stations.filter(s=>s.downlink&&!s.uplink).map(s=>s.id),['sta8','sta12','sta15']);
assert.deepEqual(stations.filter(s=>!s.downlink&&s.uplink).map(s=>s.id),['sta13','sta18']);
console.log('PASS: video startup, interruptions, recovery, stable throughput convergence, reference means, directional traffic and live SVGs across 18 configurations.');
