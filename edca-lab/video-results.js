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
        <div><h3>Resolution and interruptions</h3><p>The top row reports median resolution across five seeds and identifies playback interruptions. The maximum representations are 2160p for STA 01 and 1440p for STA 05.</p></div>
        <div><h3>Downlink throughput</h3><p>The time series use a centered 5-second average. Table 6 gives maximum-resolution encoding rates of <strong>16.88 Mbit/s</strong> and <strong>8.44 Mbit/s</strong>; IP throughput also includes protocol headers.</p></div>
        <div><h3>Buffered content</h3><p>Buffer size is the sum of the buffered segments’ encoded content, in Mbit. A full buffer is approximately <strong>159 Mbit</strong> for STA 01 or <strong>79 Mbit</strong> for STA 05: about 9.4 s at maximum resolution.</p></div>
      </div>
      <figure class="video-throughput-figure">
        <div class="video-subheading"><h3>Mean downlink IP throughput</h3><span>Selected mode shown in blue</span></div>
        <div class="video-throughput-scroll" tabindex="0" role="region" aria-label="Video throughput comparison; scroll horizontally if needed" data-throughput-chart></div>
        <figcaption data-throughput-caption></figcaption>
      </figure>
      <div class="video-study-observation"><h3>Observation for the selected mode</h3><p data-video-observation></p></div>
      <figure class="video-original-figure">
        <div class="video-subheading"><h3 data-figure-heading></h3><a class="video-original-link" data-figure-link target="_blank" rel="noopener noreferrer">Open original figure <span aria-hidden="true">↗</span></a></div>
        <p class="video-figure-guide" data-figure-guide></p>
        <div class="video-original-scroll" tabindex="0" role="region" aria-label="Original paper video plots; scroll horizontally to inspect every axis and legend"><img class="video-original-image" data-figure-image loading="lazy" decoding="async" width="1376" height="1051" alt=""></div>
        <p class="video-figure-error" data-figure-error hidden>The figure could not be loaded. Use “Open original figure” to open the image directly.</p>
        <figcaption data-figure-caption></figcaption>
      </figure>
      <div class="video-study-notes">
        <p>In the original time series, throughput and buffer curves show the mean across five seeds with the minimum-to-maximum range; resolution is the median. Figure 12 additionally enlarges the buffer interval from t = 2 to 16 s. The figures retain their original axes, labels and legends.</p>
        <p>Buffer Mbit cannot generally be calculated as current buffer seconds multiplied by the current representation’s encoding rate, because buffered segments may use different representations. The animated player’s buffer and resolution are illustrative; these figures are the paper’s reported results.</p>
        <p data-figure-rate-note hidden>Figure 16 retains the original 20 and 10 Mbit/s labels in its titles. The dashed line above uses the distinct Table 6 encoding criteria of 16.88 and 8.44 Mbit/s; the original image has not been relabeled.</p>
      </div>
    </div>`;

  const find = selector => root.querySelector(selector);
  const image = find('[data-figure-image]');
  image.addEventListener('error', () => { find('[data-figure-error]').hidden = false; });
  image.addEventListener('load', () => { find('[data-figure-error]').hidden = true; });
  let previousKey = '';
  let previousFigure = 0;

  return function updateVideoResults({config, selectedVideo}) {
    const key = JSON.stringify([config.mode, config.obss, config.neighbors, selectedVideo]);
    if (key === previousKey) return;
    const flow = FLOWS.find(item => item.id === selectedVideo && item.type === 'video') || FLOWS.find(item => item.type === 'video');
    const rows = MODES.map(mode => ({mode, value: getReference({...config, mode}).find(item => item.id === flow.id).throughput}));
    const crowded = config.obss > 0 && config.neighbors === 'QoS';
    const figureNumber = crowded ? 16 : 12;
    const rateFigure = crowded ? 15 : 11;
    const scenario = scenarioLabel(config);
    const station = `STA ${String(flow.sta).padStart(2, '0')}`;
    const scenarioColumns = config.obss ? `+${config.obss} ${config.obss === 1 ? 'OBSS' : 'OBSSs'}` : 'Home';

    find('[data-video-context]').textContent = `${station} · ${flow.maxResolution}p maximum · ${scenario} · ${config.mode}`;
    find('[data-throughput-chart]').innerHTML = throughputChart(rows, flow, config.mode, prefix);
    find('[data-throughput-caption]').textContent = `Rounded values printed in Figure ${rateFigure}: mean across five seeds, from t = 7 s to the last received packet. The dashed line marks the Table 6 encoding rate for ${flow.maxResolution}p (${number.format(flow.encodingRate)} Mbit/s). These are study results, not measurements of the animated session.`;
    find('[data-video-observation]').textContent = studyObservation(config, flow);
    find('[data-figure-heading]').textContent = `Figure ${figureNumber} · Video time series`;
    find('[data-figure-guide]').textContent = `The original figure compares both video stations across the scenarios shown. Read the ${scenarioColumns} columns for ${station}, and use the legend to identify ${config.mode}. Scroll horizontally on smaller screens to inspect every plot.`;
    find('[data-figure-caption]').textContent = figureNumber === 12
      ? 'Supplied draft, Figure 12 (p. 14) · Best Effort neighbors. From top to bottom: resolution and interruptions; downlink IP throughput; buffered content in Mbit; buffer detail for t = 2–16 s.'
      : 'Supplied draft, Figure 16 (p. 17) · Prioritized neighbors. From top to bottom: resolution and interruptions; downlink IP throughput; buffered content in Mbit.';
    find('[data-figure-rate-note]').hidden = figureNumber !== 16;

    if (previousFigure !== figureNumber) {
      const source = `assets/paper-video/figure-${figureNumber}.png`;
      find('[data-figure-error]').hidden = true;
      find('[data-figure-link]').href = source;
      image.width = figureNumber === 12 ? 1376 : 1349;
      image.height = figureNumber === 12 ? 1051 : 1044;
      image.alt = `Original Figure ${figureNumber} from the study, showing both STA 01 and STA 05 across the study scenarios. ${figureNumber === 12 ? 'Four rows: resolution and interruptions, downlink throughput, buffer Mbit, and buffer detail from 2 to 16 seconds.' : 'Three rows: resolution and interruptions, downlink throughput, and buffer Mbit.'} All original axes and legends are retained.`;
      image.src = source;
      previousFigure = figureNumber;
    }
    previousKey = key;
  };
}
