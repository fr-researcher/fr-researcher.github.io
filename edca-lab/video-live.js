import {FLOWS, PAPER} from './model.js';

const MODES = ['BE', 'QoS-ML', 'QoS-App'];
const SVG = {width:360, height:250, left:50, right:14, top:42, bottom:214};
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const fixed = value => Number(value).toLocaleString('en-US', {minimumFractionDigits:1, maximumFractionDigits:1});
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
let instances = 0;

function pointFromFlow(time, flow) {
  return {time, resolution:finite(flow.resolution), stalled:Boolean(flow.stalled), throughput:finite(flow.throughput), bufferSeconds:finite(flow.bufferSeconds)};
}

/** Pure, immutable view of the selected stream, bounded by the simulation clock. */
export function buildVideoLiveState({snapshot, samples=[], selectedVideo, modeChanges=[], running=false, speed=1, config={}}) {
  const definition = FLOWS.find(flow => flow.id === selectedVideo && flow.type === 'video') || FLOWS.find(flow => flow.type === 'video');
  const flow = snapshot.flows.find(item => item.id === definition.id) || definition;
  const elapsed = clamp(finite(snapshot.time), 0, PAPER.duration);
  const current = pointFromFlow(elapsed, flow);
  const waiting = elapsed < PAPER.trafficStart;
  const points = samples
    .filter(sample => Number.isFinite(sample.time) && sample.time >= PAPER.trafficStart && sample.time <= elapsed && sample.flows?.[definition.id])
    .map(sample => pointFromFlow(sample.time, sample.flows[definition.id]))
    .sort((a, b) => a.time - b.time);

  // Prefer the latest sample at a timestamp and the exact current snapshot.
  const unique = [];
  for (const point of points) {
    if (unique.length && unique[unique.length - 1].time === point.time) unique[unique.length - 1] = point;
    else unique.push(point);
  }
  if (!waiting) {
    if (unique.length && unique[unique.length - 1].time === elapsed) unique[unique.length - 1] = current;
    else unique.push(current);
  }

  const stalls = [];
  unique.forEach((point, index) => {
    if (!point.stalled) return;
    const end = unique[index + 1]?.time ?? elapsed;
    if (end <= point.time) return;
    const previous = stalls[stalls.length - 1];
    if (previous && previous.end === point.time) previous.end = end;
    else stalls.push({start:point.time, end});
  });
  const changes = modeChanges
    .filter(change => Number.isFinite(change.time) && change.time >= 0 && change.time <= elapsed)
    .map(change => ({time:change.time, mode:String(change.mode)}));
  const complete = Boolean(snapshot.complete) || elapsed >= PAPER.duration;
  return {
    definition, current, points:unique, stalls, changes, elapsed, waiting,
    mode:config.mode || 'BE', obss:config.obss, neighbors:config.neighbors,
    running:Boolean(running) && !complete, speed:finite(speed) || 1, complete,
    status:complete ? 'Completed' : running ? 'Running' : 'Paused',
    videoState:waiting ? 'waiting' : current.stalled ? 'stalled' : 'playing'
  };
}

function clock(time) {
  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}.${Math.floor((time % 1) * 10)}`;
}

function chartScale(kind, state) {
  if (kind === 'resolution') {
    const levels = [0, 360, 480, 720, 1080, 1440, 2160].filter(value => value <= state.definition.maxResolution);
    return {ticks:levels, maximum:levels.length - 1, value:point => point.stalled ? 0 : Math.max(1, levels.indexOf(point.resolution)), format:value => value === 0 ? 'Stall' : `${value}p`, position:value => levels.indexOf(value), threshold:null};
  }
  if (kind === 'buffer') {
    return {ticks:[0, 2, 4, 6, 8, 10], maximum:10, value:point => point.bufferSeconds, format:String, position:value => value, threshold:PAPER.fullBufferSeconds};
  }
  const base = state.definition.maxResolution === 2160 ? 25 : 12;
  const tickCount = state.definition.maxResolution === 2160 ? 5 : 4;
  const step = base / tickCount;
  const peak = Math.max(0, ...state.points.map(point => point.throughput));
  const maximum = Math.max(base, Math.ceil(peak * 1.05 / step) * step);
  return {ticks:Array.from({length:tickCount + 1}, (_, index) => index * maximum / tickCount), maximum, value:point => point.throughput, format:value => Number.isInteger(value) ? String(value) : fixed(value), position:value => value, threshold:state.definition.encodingRate};
}

/** SVG is drawn only from model samples and the current snapshot; no timer or forecast. */
export function renderVideoLiveChart(kind, state, prefix='video-live') {
  const {width, height, left, right, top, bottom} = SVG;
  const scale = chartScale(kind, state);
  const x = time => left + time / PAPER.duration * (width - left - right);
  const y = value => bottom - clamp(value, 0, scale.maximum) / scale.maximum * (bottom - top);
  const xy = point => [x(point.time), y(scale.value(point))];
  const title = kind === 'resolution' ? 'Emulated playback resolution and stalls' : kind === 'throughput' ? 'Emulated downlink IP throughput in Mbit/s' : 'Emulated buffered playback in seconds';
  const value = state.waiting ? 'Waiting for traffic' : kind === 'resolution' ? state.current.stalled ? 'Stall' : `${state.current.resolution}p` : kind === 'throughput' ? `${fixed(state.current.throughput)} Mbit/s` : `${fixed(state.current.bufferSeconds)} seconds`;
  const description = `${state.definition.name}, STA ${state.definition.sta}. ${state.status} at ${fixed(state.elapsed)} seconds. Current value: ${value}. Samples end at the current simulation time. Light red intervals indicate stalled playback.`;
  const id = `${prefix}-${kind}`;
  let result = `<svg class="vl-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-description"><title id="${id}-title">${escape(title)}</title><desc id="${id}-description">${escape(description)}</desc>`;

  for (const interval of state.stalls) {
    result += `<rect x="${x(interval.start).toFixed(2)}" y="${top}" width="${(x(interval.end) - x(interval.start)).toFixed(2)}" height="${bottom - top}" fill="#bd5144" fill-opacity="0.09" stroke="none"/>`;
  }
  for (const tick of scale.ticks) {
    const yy = y(scale.position(tick));
    result += `<line x1="${left}" y1="${yy}" x2="${width - right}" y2="${yy}" stroke="#e4e9ec" stroke-width="1"/><text x="${left - 8}" y="${yy + 4}" text-anchor="end" fill="${kind === 'resolution' && tick === 0 ? '#aa493b' : '#63717b'}" stroke="none" font-size="12">${scale.format(tick)}</text>`;
  }
  for (let tick = 0; tick <= PAPER.duration; tick += 10) {
    result += `<text x="${x(tick)}" y="${bottom + 21}" text-anchor="middle" fill="#63717b" stroke="none" font-size="12">${tick}s</text>`;
  }
  if (scale.threshold !== null) {
    const yy = y(scale.threshold);
    result += `<line x1="${left}" y1="${yy}" x2="${width - right}" y2="${yy}" stroke="#866b42" stroke-width="1.25" stroke-dasharray="5 4"><title>${kind === 'buffer' ? 'Full-buffer reference' : 'Table 6 encoding rate'}: ${scale.threshold}</title></line>`;
  }

  const labelEnds = [-Infinity, -Infinity];
  state.changes.forEach((change, index) => {
    const xx = x(change.time);
    result += `<line x1="${xx}" y1="${top}" x2="${xx}" y2="${bottom}" stroke="#899ba8" stroke-width="1" stroke-dasharray="3 4"><title>${escape(change.mode)} at ${fixed(change.time)} s</title></line>`;
    // Closely spaced events keep their markers and tooltips without colliding labels.
    const textX = Math.min(xx + 3, width - right - 55);
    const preferred = index % 2;
    const row = textX > labelEnds[preferred] + 4 ? preferred : textX > labelEnds[1 - preferred] + 4 ? 1 - preferred : -1;
    if (row >= 0) {
      result += `<text x="${textX}" y="${14 + row * 15}" fill="#63717b" stroke="none" font-size="11">${escape(change.mode)}</text>`;
      labelEnds[row] = textX + 55;
    }
  });

  if (state.points.length) {
    const first = xy(state.points[0]);
    let path = `M${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
    state.points.slice(1).forEach(point => {
      const [xx, yy] = xy(point);
      path += kind === 'resolution' ? `H${xx.toFixed(2)}V${yy.toFixed(2)}` : `L${xx.toFixed(2)} ${yy.toFixed(2)}`;
    });
    result += `<path d="${path}" stroke="#245e89" stroke-width="1.8" fill="none"/>`;
    const [xx, yy] = xy(state.current);
    result += `<circle cx="${xx.toFixed(2)}" cy="${yy.toFixed(2)}" r="3" fill="${state.current.stalled ? '#aa493b' : '#245e89'}" stroke="#fff" stroke-width="1.5"/>`;
  } else {
    result += `<text x="${left + (width - left - right) / 2}" y="${top + (bottom - top) / 2}" text-anchor="middle" fill="#63717b" stroke="none" font-size="12">Traffic starts at t = ${PAPER.trafficStart} s</text>`;
  }
  result += `<line x1="${x(state.elapsed).toFixed(2)}" y1="${top}" x2="${x(state.elapsed).toFixed(2)}" y2="${bottom}" stroke="${state.videoState === 'stalled' ? '#aa493b' : '#566f82'}" stroke-width="1" stroke-opacity="0.75"/></svg>`;
  return result;
}

export function initVideoLive(root, {onToggle, onReset, onVideoChange}={}) {
  if (!root) throw new TypeError('A live video indicators root is required.');
  const prefix = `video-live-${++instances}`;
  root.classList.add('video-live-results');
  root.innerHTML = `
    <div class="panel-heading"><h2>Video indicators</h2><span class="vl-badge">Live emulation</span></div>
    <div class="vl-toolbar">
      <label class="vl-stream-label">Stream <select data-vl-stream aria-label="Video indicators stream"><option value="sta1">STA 01 · 2160p</option><option value="sta5">STA 05 · 1440p</option></select></label>
      <div class="vl-modes" role="group" aria-label="Video emulation mode">${MODES.map(mode => `<button type="button" data-mode="${mode}" aria-pressed="false">${mode}</button>`).join('')}</div>
      <div class="vl-playback"><button type="button" data-vl-toggle aria-label="Pause video indicators">Pause</button><button type="button" data-vl-reset aria-label="Reset video indicators">Reset</button></div>
    </div>
    <div class="vl-context"><span data-vl-context></span><span class="vl-clock" data-vl-clock></span></div>
    <div class="vl-charts">
      <figure class="vl-chart"><div class="vl-chart-heading"><h3>Playback resolution</h3><strong data-video-current="resolution" data-value="">Waiting</strong></div><div data-vl-chart="resolution"></div><figcaption>Step changes; “Stall” is a separate playback state.</figcaption></figure>
      <figure class="vl-chart"><div class="vl-chart-heading"><h3>Downlink throughput</h3><span><strong data-video-current="throughput" data-value="">—</strong><small> Mbit/s</small></span></div><div data-vl-chart="throughput"></div><figcaption data-vl-throughput-caption></figcaption></figure>
      <figure class="vl-chart"><div class="vl-chart-heading"><h3>Buffered playback</h3><span><strong data-video-current="buffer" data-value="">—</strong><small> s</small></span></div><div data-vl-chart="buffer"></div><figcaption>Dashed line: approximately 9.4 s at full buffer.</figcaption></figure>
    </div>
    <div class="vl-legend"><span><i class="vl-stall-key"></i>Playback stalled</span><span><i class="vl-mode-key"></i>Mode change</span><span>Time follows the simulation clock.</span></div>
    <footer class="vl-footer"><p>Illustrative emulation based on Figures 12 and 16. These plots follow the animated player; buffer is shown in seconds, while the paper reports buffered content in Mbit.</p><button type="button" data-view="compare" class="text-button">Paper reference ↗</button></footer>`;

  const find = selector => root.querySelector(selector);
  const toggle = find('[data-vl-toggle]');
  const reset = find('[data-vl-reset]');
  const stream = find('[data-vl-stream]');
  toggle.disabled = typeof onToggle !== 'function';
  reset.disabled = typeof onReset !== 'function';
  stream.disabled = typeof onVideoChange !== 'function';
  toggle.addEventListener('click', () => onToggle?.());
  reset.addEventListener('click', () => onReset?.());
  stream.addEventListener('change', event => onVideoChange?.(event.target.value));
  let previousKey = '';

  return function updateVideoLive(input) {
    const state = buildVideoLiveState(input);
    const key = JSON.stringify([state.definition.id, state.elapsed, state.current, state.points, state.changes, state.mode, state.obss, state.neighbors, state.running, state.complete, state.speed]);
    if (key === previousKey) return;
    root.dataset.elapsed = state.elapsed.toFixed(3);
    root.dataset.samplecount = String(state.points.length);
    root.dataset.videostate = state.videoState;
    root.dataset.video = state.definition.id;
    root.dataset.status = state.status.toLowerCase();
    root.dataset.mode = state.mode;
    find('[data-vl-context]').textContent = `STA ${String(state.definition.sta).padStart(2, '0')} · ${state.mode} · ${state.waiting ? 'Waiting for traffic' : state.current.stalled ? 'Playback stalled' : `${state.current.resolution}p playback`}`;
    find('[data-vl-clock]').textContent = `${state.status} · ${clock(state.elapsed)} / 01:00 · ${state.speed}×`;
    stream.value = state.definition.id;
    toggle.textContent = state.complete ? 'Replay' : state.running ? 'Pause' : 'Resume';
    toggle.setAttribute('aria-label', `${toggle.textContent} video indicators`);
    for (const button of root.querySelectorAll('.vl-modes [data-mode]')) {
      const selected = button.dataset.mode === state.mode;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    const resolution = find('[data-video-current="resolution"]');
    resolution.textContent = state.waiting ? 'Waiting' : state.current.stalled ? 'Stall' : `${state.current.resolution}p`;
    resolution.dataset.value = state.waiting ? 'waiting' : state.current.stalled ? 'stall' : String(state.current.resolution);
    resolution.dataset.state = state.videoState;
    const throughput = find('[data-video-current="throughput"]');
    throughput.textContent = state.waiting ? '—' : fixed(state.current.throughput);
    throughput.dataset.value = String(state.current.throughput);
    const buffer = find('[data-video-current="buffer"]');
    buffer.textContent = state.waiting ? '—' : fixed(state.current.bufferSeconds);
    buffer.dataset.value = String(state.current.bufferSeconds);
    for (const kind of ['resolution', 'throughput', 'buffer']) {
      find(`[data-vl-chart="${kind}"]`).innerHTML = renderVideoLiveChart(kind, state, prefix);
    }
    find('[data-vl-throughput-caption]').textContent = `Dashed line: Table 6 encoding rate, ${state.definition.encodingRate.toFixed(2)} Mbit/s. IP throughput includes headers.`;
    previousKey = key;
  };
}
