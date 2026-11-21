import { inRange, series, sensorUrl } from './metrics-data.mjs';
const meshcoreSchema = 'meshcore_message_count';
const $ = id => document.getElementById(id);
const state = { devices: [], rows: [], next: null, bounds: null, controller: null, busy: false };
const date = seconds => Number.isFinite(seconds) ? new Date(seconds * 1000).toLocaleString() : 'Unknown';
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
const apiReady = new Promise(resolve => {
  if (window.Alpine?.store('api')) resolve();
  else document.addEventListener('alpine:initialized', resolve, { once: true });
});
async function request(name, params, controller) {
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    await apiReady;
    controller.signal.throwIfAborted();
    const result = await Alpine.store('api').call(name, params, null, { signal: controller.signal });
    controller.signal.throwIfAborted();
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
async function pageRows(device, bounds, cursor, controller) {
  const page = await request('iot_device_metrics', {
    device_id: device,
    limit: 500,
    ...bounds,
    ...(cursor && { before_id: cursor.id, before_observed_at: cursor.time }),
  }, controller);
  const id = page.next_before_id;
  const time = page.next_before_observed_at;
  if (!Array.isArray(page.metrics) ||
      !(id === null && time === null ||
        Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(time) &&
        time >= bounds.since && time <= bounds.until)) {
    throw new Error('Unexpected metric response from the server.');
  }
  if (id !== null && cursor && (time > cursor.time || time === cursor.time && id >= cursor.id)) {
    throw new Error('The server returned a non-advancing page cursor.');
  }
  return { rows: page.metrics, next: id === null ? null : { id, time } };
}
function clearReadings() {
  state.rows = [];
  state.next = null;
  state.bounds = null;
  render();
}
async function load({ devices = false, more = false } = {}) {
  if (more && !state.next) return;
  state.controller?.abort();
  const controller = new AbortController(); state.controller = controller;
  state.busy = true; $('refresh').disabled = true; $('load-more').disabled = true;
  status('Loading sensor reports…');
  try {
    if (devices) {
      const list = await request('iot_devices', {}, controller);
      controller.signal.throwIfAborted();
      if (!Array.isArray(list.devices)) throw new Error('Unexpected device response from the server.');
      const previous = $('device').value;
      state.devices = list.devices;
      $('device').replaceChildren();
      for (const device of list.devices) {
        const option = element('option', device.name ? `${device.name} · ${device.device_id}` : device.device_id);
        option.value = device.device_id; $('device').append(option);
      }
      if (list.devices.some(d => d.device_id === previous)) $('device').value = previous;
      else clearReadings();
      $('device').disabled = !list.devices.length;
      if (!list.devices.length) $('device').append(element('option', 'No registered devices'));
    }
    const device = $('device').value;
    if (!state.devices.length) {
      clearReadings();
      status('No devices yet. They will appear after sending a discovery or metric report.');
      return;
    }
    const until = Math.floor(Date.now() / 1000);
    const bounds = more ? state.bounds : { since: until - Number($('range').value) * 3600, until };
    let cursor = more ? state.next : null;
    let rows = more ? state.rows : [];
    // Render each page while keeping every request in the original time window.
    do {
      const result = await pageRows(device, bounds, cursor, controller);
      controller.signal.throwIfAborted();
      rows = rows.concat(result.rows);
      cursor = result.next;
      state.rows = rows;
      state.next = cursor;
      state.bounds = bounds;
      render();
    } while (cursor !== null);
    status(`Updated ${new Date().toLocaleTimeString()} · ${rows.length.toLocaleString()} stored reports loaded`);
  } catch (error) {
    if (controller !== state.controller) return;
    if (error.status === 401 || error.status === 403) {
      state.devices = [];
      clearReadings();
      status('Please sign in to view sensor metrics. Use the sign-in link above.', true);
      return;
    }
    status(controller.signal.aborted ? 'Loading timed out. Try again.' : error.message, true);
  } finally {
    if (controller === state.controller) { state.busy = false; $('refresh').disabled = false; $('load-more').disabled = false; }
  }
}
function card(label, value, note) { const node = element('article', undefined, 'metric-card'); node.append(element('h2', label), element('strong', value), element('p', note)); $('summary').append(node); }
function chart(title, points, unit, end, bars = false) {
  if (!points.length) return;
  const section = element('section', undefined, 'chart-card'); section.append(element('h2', title));
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 900 250'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${title}. ${points.length} readings. Exact values are in the recorded readings table.`);
  const add = (tag, attrs, text) => { const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); if (text !== undefined) node.textContent = text; svg.append(node); return node; };
  const start = end - Number($('range').value) * 3600000;
  let min = bars ? 0 : points.reduce((value, p) => Math.min(value, p.value), Infinity), max = points.reduce((value, p) => Math.max(value, p.value), -Infinity);
  if (max === min) { max += 1; if (!bars) min -= 1; }
  const steps = bars ? Math.min(4, max) : 4;
  const x = time => 65 + (time - start) / (end - start) * 815;
  const y = value => 200 - (value - min) / (max - min) * 170;
  for (let i = 0; i <= steps; i++) { const tick = min + (max - min) * i / steps; const value = bars ? Math.round(tick) : tick; add('line', { x1: 65, x2: 880, y1: y(value), y2: y(value), class: 'grid' }); add('text', { x: 55, y: y(value) + 4, 'text-anchor': 'end', class: 'axis' }, value.toFixed(bars ? 0 : 1)); }
  for (const [time, anchor] of [[start, 'start'], [(start + end) / 2, 'middle'], [end, 'end']]) add('text', { x: x(time), y: 230, 'text-anchor': anchor, class: 'axis' }, new Date(time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
  if (!bars) {
    // A long reporting gap remains visible instead of implying continuous data.
    let segment = [];
    const flush = () => { if (segment.length > 1) add('polyline', { points: segment.map(p => `${x(p.time)},${y(p.value)}`).join(' '), fill: 'none', stroke: '#39765a', 'stroke-width': 2 }); segment = []; };
    for (const point of points) { if (segment.length && point.time - segment.at(-1).time > 600000) flush(); segment.push(point); } flush();
  }
  for (const point of points) {
    const mark = bars && point.value !== 0 ? add('line', { x1: x(point.time), x2: x(point.time), y1: y(0), y2: y(point.value), stroke: '#39765a', 'stroke-width': 4 }) : add('circle', { cx: x(point.time), cy: y(point.value), r: 3, fill: '#39765a' });
    const tooltip = document.createElementNS(ns, 'title'); tooltip.textContent = `${new Date(point.time).toLocaleString()}: ${point.value} ${unit}`; mark.append(tooltip);
  }
  section.append(svg); $('charts').append(section);
}
function meshcoreReading(data) {
  const parts = [];
  for (const [field, label] of [['public_count', 'public'], ['dm_count', 'direct'], ['neighbor_count', 'neighbors']]) {
    if (Number.isFinite(data[field])) parts.push(`${data[field]} ${label}`);
  }
  for (const [channel, count] of Object.entries(data.channel_counts ?? {})) {
    if (!Number.isFinite(count)) continue;
    const label = String(data.public_channel) === channel ? `Channel ${channel} (public)` : `Channel ${channel}`;
    parts.push(`${label}: ${count}`);
  }
  if (Number.isFinite(data.listening_ms)) parts.push(`Listened for ${(data.listening_ms / 1000).toLocaleString()} s`);
  if (data.neighbors_truncated === true) parts.push('Neighbor list truncated');
  return parts.join(' · ') || JSON.stringify(data);
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
  const now = (state.bounds?.until ?? Math.floor(Date.now() / 1000)) * 1000;
  const rows = inRange(state.rows, Number($('range').value), now);
  $('summary').replaceChildren(); $('charts').replaceChildren(); $('readings').replaceChildren();
  $('coverage').textContent = !state.bounds ? '' : state.next !== null ? 'Partial period loaded. Totals cover only the reports shown.' : `${rows.length.toLocaleString()} readings in this period. Times are shown in your local timezone.`;
  $('load-more').hidden = state.next === null;
  const temperatures = series(rows, 'temperature', 'temperature_c'), humidity = series(rows, 'temperature', 'humidity_percent'), touches = series(rows, 'touch_count', 'count');
  if (temperatures.length) card('Latest temperature in period', `${temperatures.at(-1).value.toFixed(1)} °C`, new Date(temperatures.at(-1).time).toLocaleString());
  if (humidity.length) card('Latest humidity in period', `${humidity.at(-1).value.toFixed(1)}%`, new Date(humidity.at(-1).time).toLocaleString());
  if (touches.length) card(state.next !== null ? 'Touches in loaded reports' : 'Touches reported in period', touches.reduce((sum, point) => sum + point.value, 0).toLocaleString(), 'Sum of interval counts; totals since boot are not added.');
  if (!rows.length && state.bounds) $('charts').append(element('p', 'No readings in this time range.', 'empty'));
  chart('Temperature · °C', temperatures, '°C', now);
  chart('Humidity · %', humidity, '%', now);
  chart('Touches · per reporting interval', touches, 'touches', now, true);
  for (const [field, label, unit] of [
    ['public_count', 'Public messages per listening window', 'public messages'],
    ['dm_count', 'Direct messages per listening window', 'direct messages'],
    ['neighbor_count', 'Neighbors per report', 'neighbors'],
  ]) {
    const points = series(rows, meshcoreSchema, field);
    if (!points.length) continue;
    const isNeighborCount = field === 'neighbor_count';
    const value = isNeighborCount ? points.at(-1).value : points.reduce((sum, point) => sum + point.value, 0);
    card(isNeighborCount ? 'Latest reported neighbor count' : `Reported ${unit}`, value.toLocaleString(),
      isNeighborCount ? new Date(points.at(-1).time).toLocaleString() : `Sum across ${points.length.toLocaleString()} loaded reports in this period.`);
    chart(`MeshCore · ${label}`, points, unit, now, true);
  }
  for (const row of [...rows].reverse()) {
    const reading = row.reading, data = reading.data || {};
    const value = reading.schema === 'temperature' ? `${data.temperature_c} °C · ${data.humidity_percent}% humidity` : reading.schema === 'touch_count' ? `${data.count} touches · ${data.total_count} since boot` : reading.schema === meshcoreSchema ? meshcoreReading(data) : JSON.stringify(data);
    const schema = reading.schema === meshcoreSchema ? 'MeshCore message count' : reading.schema;
    const tr = element('tr'); for (const text of [date(reading.observed_at_unix), schema, value, date(row.received_at_unix)]) tr.append(element('td', text)); $('readings').append(tr);
  }
}
$('refresh').addEventListener('click', () => load({ devices: true }));
function loadSelection() {
  clearReadings();
  return load({ devices: !state.devices.length });
}
$('device').addEventListener('change', loadSelection);
$('range').addEventListener('change', loadSelection);
$('load-more').addEventListener('click', () => load({ more: true }));
setInterval(() => { if ($('auto-refresh').checked && !document.hidden && !state.busy) load({ devices: true }); }, 30000);
load({ devices: true });
