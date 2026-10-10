import { inRange, series, sensorUrl } from './metrics-data.mjs';
const root = document.querySelector('#metrics-app');
const $ = id => document.getElementById(id);
const state = { devices: [], rows: [], next: null, controller: null, busy: false, updated: null };
const date = seconds => Number.isFinite(seconds) ? new Date(seconds * 1000).toLocaleString() : 'Unknown';
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
let base = root.dataset.apiBase;
try { base = sessionStorage.getItem('workshop.metrics.api') || base; } catch { /* storage unavailable */ }
$('api-base').value = base;
function normalizeBase(value) {
  const url = new URL(value, location.origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Enter an HTTP or HTTPS API address without credentials, query, or fragment.');
  return url.href.replace(/\/$/, '');
}
async function request(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'The server denied access to metrics. Check the server’s viewer access settings.' : `The server returned ${response.status}. Check the Sensor API address.`);
  try { return await response.json(); } catch { throw new Error('The API returned a page instead of JSON. Check the Sensor API address.'); }
}
async function pageRows(device, cursor, signal) {
  const url = `${base}/devices/${encodeURIComponent(device)}/metrics?limit=500${cursor === null ? '' : `&before_id=${cursor}`}`;
  const page = await request(url, signal);
  if (!Array.isArray(page.metrics) || !(page.next_before_id === null || Number.isSafeInteger(page.next_before_id) && page.next_before_id > 0)) throw new Error('Unexpected metric response from the server.');
  return page;
}
async function load({ devices = false, more = false } = {}) {
  state.controller?.abort();
  const controller = new AbortController(); state.controller = controller;
  const timeout = setTimeout(() => controller.abort(), 30000);
  state.busy = true; $('refresh').disabled = true; $('load-more').disabled = true;
  status('Loading sensor reports…');
  try {
    base = normalizeBase($('api-base').value.trim());
    if (devices) {
      const list = await request(`${base}/devices`, controller.signal);
      if (!Array.isArray(list.devices)) throw new Error('Unexpected device response from the server.');
      const previous = $('device').value;
      state.devices = list.devices;
      $('device').replaceChildren();
      for (const device of list.devices) {
        const option = element('option', device.name ? `${device.name} · ${device.device_id}` : device.device_id);
        option.value = device.device_id; $('device').append(option);
      }
      if (list.devices.some(d => d.device_id === previous)) $('device').value = previous;
      else { state.rows = []; state.next = null; render(); }
      $('device').disabled = !list.devices.length;
      if (!list.devices.length) $('device').append(element('option', 'No registered devices'));
    }
    const device = $('device').value;
    if (!state.devices.length) {
      state.rows = []; state.next = null; render(); status('No devices yet. They will appear after sending a discovery or metric report.'); return;
    }
    let cursor = more ? state.next : null;
    let rows = more ? [...state.rows] : [];
    const ids = new Set(rows.map(row => row.id));
    // Bound each refresh. Never imply full-period totals while older pages remain.
    for (let page = 0; page < 20; page++) {
      const result = await pageRows(device, cursor, controller.signal);
      for (const row of result.metrics) if (!ids.has(row.id)) { rows.push(row); ids.add(row.id); }
      if (result.next_before_id !== null && cursor !== null && result.next_before_id >= cursor) throw new Error('The server returned a non-advancing page cursor.');
      cursor = result.next_before_id;
      if (cursor === null) break;
    }
    if (controller.signal.aborted) return;
    state.rows = rows; state.next = cursor; state.updated = new Date();
    render(); status(`Updated ${state.updated.toLocaleTimeString()} · ${rows.length.toLocaleString()} stored reports loaded`);
  } catch (error) {
    if (controller !== state.controller) return;
    status(controller.signal.aborted ? 'Loading timed out. Check the API address and try again.' : `${error.message} Previously loaded readings, if any, have not been refreshed.`, true);
  } finally {
    clearTimeout(timeout);
    if (controller === state.controller) { state.busy = false; $('refresh').disabled = false; $('load-more').disabled = false; }
  }
}
function card(label, value, note) { const node = element('article', undefined, 'metric-card'); node.append(element('h2', label), element('strong', value), element('p', note)); $('summary').append(node); }
function chart(title, points, unit, bars = false) {
  if (!points.length) return;
  const section = element('section', undefined, 'chart-card'); section.append(element('h2', title));
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 900 250'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${title}. ${points.length} readings. Exact values are in the recorded readings table.`);
  const add = (tag, attrs, text) => { const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); if (text !== undefined) node.textContent = text; svg.append(node); return node; };
  const end = Date.now(), start = end - Number($('range').value) * 3600000;
  let min = bars ? 0 : points.reduce((value, p) => Math.min(value, p.value), Infinity), max = points.reduce((value, p) => Math.max(value, p.value), -Infinity);
  if (max === min) { max += 1; if (!bars) min -= 1; }
  const x = time => 65 + (time - start) / (end - start) * 815;
  const y = value => 200 - (value - min) / (max - min) * 170;
  for (let i = 0; i <= 4; i++) { const value = min + (max - min) * i / 4; add('line', { x1: 65, x2: 880, y1: y(value), y2: y(value), class: 'grid' }); add('text', { x: 55, y: y(value) + 4, 'text-anchor': 'end', class: 'axis' }, value.toFixed(bars ? 0 : 1)); }
  for (const [time, anchor] of [[start, 'start'], [(start + end) / 2, 'middle'], [end, 'end']]) add('text', { x: x(time), y: 230, 'text-anchor': anchor, class: 'axis' }, new Date(time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
  if (!bars) {
    // A long reporting gap remains visible instead of implying continuous data.
    let segment = [];
    const flush = () => { if (segment.length > 1) add('polyline', { points: segment.map(p => `${x(p.time)},${y(p.value)}`).join(' '), fill: 'none', stroke: '#39765a', 'stroke-width': 2 }); segment = []; };
    for (const point of points) { if (segment.length && point.time - segment.at(-1).time > 600000) flush(); segment.push(point); } flush();
  }
  for (const point of points) {
    const mark = bars ? add('line', { x1: x(point.time), x2: x(point.time), y1: y(0), y2: y(point.value), stroke: '#39765a', 'stroke-width': 4 }) : add('circle', { cx: x(point.time), cy: y(point.value), r: 3, fill: '#39765a' });
    const tooltip = document.createElementNS(ns, 'title'); tooltip.textContent = `${new Date(point.time).toLocaleString()}: ${point.value} ${unit}`; mark.append(tooltip);
  }
  section.append(svg); $('charts').append(section);
}
function render() {
  const selected = state.devices.find(d => d.device_id === $('device').value);
  $('device-info').hidden = !selected;
  if (selected) {
    const minutes = Math.max(0, Math.floor((Date.now() / 1000 - selected.last_seen_unix) / 60));
    $('device-description').textContent = `${selected.device_id} · Last contact ${date(selected.last_seen_unix)}${minutes > 15 ? ' · No recent contact' : ''}`;
    const url = sensorUrl(selected.sensor_url); $('sensor-link').hidden = !url;
    if (url) $('sensor-link').href = url; else $('sensor-link').removeAttribute('href');
  }
  const rows = inRange(state.rows, Number($('range').value));
  $('summary').replaceChildren(); $('charts').replaceChildren(); $('readings').replaceChildren();
  $('coverage').textContent = state.next !== null ? 'Partial history loaded. Totals cover only loaded reports; load older reports to complete the selected period.' : `${rows.length.toLocaleString()} readings in this period. Times are shown in your local timezone.`;
  $('load-more').hidden = state.next === null;
  const temperatures = series(rows, 'temperature', 'temperature_c'), humidity = series(rows, 'temperature', 'humidity_percent'), touches = series(rows, 'touch_count', 'count');
  if (temperatures.length) card('Latest temperature in period', `${temperatures.at(-1).value.toFixed(1)} °C`, new Date(temperatures.at(-1).time).toLocaleString());
  if (humidity.length) card('Latest humidity in period', `${humidity.at(-1).value.toFixed(1)}%`, new Date(humidity.at(-1).time).toLocaleString());
  if (touches.length) card(state.next !== null ? 'Touches in loaded reports' : 'Touches reported in period', touches.reduce((sum, point) => sum + point.value, 0).toLocaleString(), 'Sum of interval counts; totals since boot are not added.');
  if (!rows.length) $('charts').append(element('p', 'No readings in this time range.', 'empty'));
  chart('Temperature · °C', temperatures, '°C'); chart('Humidity · %', humidity, '%'); chart('Touches · per reporting interval', touches, 'touches', true);
  for (const row of [...rows].reverse()) {
    const reading = row.reading, data = reading.data || {};
    const value = reading.schema === 'temperature' ? `${data.temperature_c} °C · ${data.humidity_percent}% humidity` : reading.schema === 'touch_count' ? `${data.count} touches · ${data.total_count} since boot` : 'Unsupported reading type';
    const tr = element('tr'); for (const text of [date(reading.observed_at_unix), reading.schema, value, date(row.received_at_unix)]) tr.append(element('td', text)); $('readings').append(tr);
  }
}
$('connection').addEventListener('submit', event => { event.preventDefault(); state.rows = []; state.next = null; state.devices = []; render(); try { sessionStorage.setItem('workshop.metrics.api', normalizeBase($('api-base').value.trim())); } catch { /* load reports validation errors */ } load({ devices: true }); });
$('refresh').addEventListener('click', () => load({ devices: true }));
$('device').addEventListener('change', () => { state.rows = []; state.next = null; render(); load(); });
$('range').addEventListener('change', render);
$('load-more').addEventListener('click', () => load({ more: true }));
setInterval(() => { if ($('auto-refresh').checked && !document.hidden && !state.busy) load({ devices: true }); }, 30000);
load({ devices: true });
