import {getReference, FLOWS} from './model.js?v=20261007-paper-check';

const MODES = ['BE', 'QoS-ML', 'QoS-App'];
const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
let instances = 0;

function scenarioLabel(config) {
  if (!config.obss) return 'Home only';
  return `Home + ${config.obss} ${config.obss === 1 ? 'neighbor' : 'neighbors'} · ${config.neighbors === 'QoS' ? 'neighbors use QoS-App' : 'neighbors use Best Effort'}`;
}

function studyObservation(config, flow) {
  const station = `STA ${String(flow.sta).padStart(2, '0')}`;
  if (!config.obss || config.neighbors === 'BE') {
    return `${station} maintains ${flow.maxResolution}p without playback interruptions in all three modes. The buffer reaches its maximum level.${flow.id === 'sta1' && config.obss === 2 ? ' With two Best Effort neighbors, QoS-ML accelerates STA 01 buffer filling after classification.' : ''}`;
  }
  if (config.mode === 'QoS-App') {
    return `${station} maintains ${flow.maxResolution}p without playback interruptions with source marking, despite contention from the prioritized neighboring ${config.obss === 1 ? 'network' : 'networks'}.`;
  }
  if (config.mode === 'QoS-ML') {
    if (flow.id === 'sta1') return 'STA 01 experiences an interruption at approximately 5–8 s, then returns to 2160p after classification and priority marking.';
    return `STA 05 starts at 480p and reaches 1440p near t = 15 s.${config.obss === 2 ? ' With two prioritized neighbors, playback also stalls at approximately 5–7 s.' : ' With one prioritized neighbor, the resolution increases without a playback interruption.'}`;
  }
  if (config.obss === 1) {
    return flow.id === 'sta1'
      ? 'STA 01 has playback interruptions at approximately 5–12 s, then mainly uses 720p or 1080p, with a brief 1440p interval. Its buffer ends near 90 Mbit.'
      : 'STA 05 mainly uses 480p under Best Effort contention with one prioritized neighbor. Its buffer ends near 30 Mbit.';
  }
  return flow.id === 'sta1'
    ? 'After its initial playback, STA 01 is stalled until approximately t = 30 s, then alternates low resolutions of 360–480p with further interruptions. Its buffer stays nearly empty.'
    : 'STA 05 alternates 360p playback and interruptions. Its buffer stays nearly empty with two prioritized neighbors.';
}

function throughputChart(rows, flow, currentMode, prefix) {
  const width = 780, height = 240, left = 103, right = 93, top = 44, bottom = 199;
  const maximum = flow.id === 'sta1' ? 25 : 12;
  const tickStep = flow.id === 'sta1' ? 5 : 2;
  const x = value => left + value / maximum * (width - left - right);
  const threshold = flow.encodingRate;
  const chartTitle = `Reported downlink IP throughput for STA ${flow.sta}`;
  const chartDescription = `${rows.map(row => `${row.mode}: ${number.format(row.value)} Mbit/s`).join('; ')}. Table 6 maximum-resolution encoding rate: ${number.format(threshold)} Mbit/s. Current mode: ${currentMode}. Values are means across five seeds.`;
  let svg = `<svg class="video-throughput-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${prefix}-chart-title ${prefix}-chart-description"><title id="${prefix}-chart-title">${escape(chartTitle)}</title><desc id="${prefix}-chart-description">${escape(chartDescription)}</desc>`;
  for (let tick = 0; tick <= maximum; tick += tickStep) {
    svg += `<line x1="${x(tick)}" y1="${top}" x2="${x(tick)}" y2="${bottom}" stroke="#e0e6ea" stroke-width="1"/><text x="${x(tick)}" y="${bottom + 23}" text-anchor="middle" fill="#63717b" stroke="none" font-size="14">${tick}</text>`;
  }
  rows.forEach((row, index) => {
    const y = top + 12 + index * 48;
    const selected = row.mode === currentMode;
    svg += `<text x="${left - 13}" y="${y + 18}" text-anchor="end" fill="#26323b" stroke="none" font-size="15" font-weight="${selected ? 600 : 400}">${escape(row.mode)}</text><rect x="${left}" y="${y}" width="${Math.max(0, x(row.value) - left)}" height="26" fill="${selected ? '#245e89' : '#a8bac7'}" stroke="none"/><text x="${x(row.value) + 9}" y="${y + 18}" fill="#26323b" stroke="none" font-size="15" font-weight="600">${number.format(row.value)}</text>`;
  });
  svg += `<line x1="${x(threshold)}" y1="${top - 8}" x2="${x(threshold)}" y2="${bottom}" stroke="#866b42" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${x(threshold)}" y="22" text-anchor="middle" fill="#765c36" stroke="none" font-size="14">Encoding ${number.format(threshold)} Mbit/s</text><text x="${width - 5}" y="${bottom + 23}" text-anchor="end" fill="#63717b" stroke="none" font-size="14">Mbit/s</text></svg>`;
  return svg;
}

/** Render reported video results independently of the animated browser model. */
export function initVideoResults(root) {
  if (!root) throw new TypeError('A video results root element is required.');
  const prefix = `video-study-${++instances}`;
  root.classList.add('video-study-results');
  root.innerHTML = `
    <div class="panel-heading"><h2>Video study reference</h2><span class="video-paper-badge">Paper results</span></div>
    <div class="video-study-body">
      <p class="video-study-context" data-video-context aria-live="polite"></p>
      <div class="video-indicator-definitions">
        <div><h3>Resolution and interruptions</h3><p>The paper reports median playback resolution across five seeds and identifies interruptions. The maximum representations are 2160p for STA 01 and 1440p for STA 05.</p></div>
        <div><h3>Downlink throughput</h3><p>The paper's time series use a centered 5-second average. Table 6 gives maximum-resolution encoding rates of <strong>16.88 Mbit/s</strong> and <strong>8.44 Mbit/s</strong>; IP throughput also includes protocol headers.</p></div>
        <div><h3>Buffered content</h3><p>Buffer size is the sum of the buffered segments’ encoded content, in Mbit. A full buffer is approximately <strong>159 Mbit</strong> for STA 01 or <strong>79 Mbit</strong> for STA 05: about 9.4 s at maximum resolution.</p></div>
      </div>
      <figure class="video-throughput-figure">
        <div class="video-subheading"><h3>Mean downlink IP throughput</h3><span>Selected mode shown in blue</span></div>
        <div class="video-throughput-scroll" tabindex="0" role="region" aria-label="Video throughput comparison; scroll horizontally if needed" data-throughput-chart></div>
        <figcaption data-throughput-caption></figcaption>
      </figure>
      <div class="video-study-observation"><h3>Observation for the selected mode</h3><p data-video-observation></p></div>
      <div class="video-study-notes">
        <p>Buffer Mbit cannot generally be calculated as current buffer seconds multiplied by the current representation’s encoding rate, because buffered segments may use different representations. The animated player’s buffer and resolution are illustrative. The comparison above uses the paper’s reported throughput values.</p>
      </div>
    </div>`;

  const find = selector => root.querySelector(selector);
  let previousKey = '';

  return function updateVideoResults({config, selectedVideo}) {
    const key = JSON.stringify([config.mode, config.obss, config.neighbors, selectedVideo]);
    if (key === previousKey) return;
    const flow = FLOWS.find(item => item.id === selectedVideo && item.type === 'video') || FLOWS.find(item => item.type === 'video');
    const rows = MODES.map(mode => ({mode, value: getReference({...config, mode}).find(item => item.id === flow.id).throughput}));
    const crowded = config.obss > 0 && config.neighbors === 'QoS';
    const rateFigure = crowded ? 15 : 11;
    const scenario = scenarioLabel(config);
    const station = `STA ${String(flow.sta).padStart(2, '0')}`;

    find('[data-video-context]').textContent = `${station} · ${flow.maxResolution}p maximum · ${scenario} · ${config.mode}`;
    find('[data-throughput-chart]').innerHTML = throughputChart(rows, flow, config.mode, prefix);
    find('[data-throughput-caption]').textContent = `Rounded values printed in Figure ${rateFigure}: mean across five seeds, from t = 7 s to the last received packet. The dashed line marks the Table 6 encoding rate for ${flow.maxResolution}p (${number.format(flow.encodingRate)} Mbit/s). These are study results, not measurements of the animated session.`;
    find('[data-video-observation]').textContent = studyObservation(config, flow);
    previousKey = key;
  };
}
