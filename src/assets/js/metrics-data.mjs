export function inRange(records, hours, now = Date.now()) {
  const start = now - hours * 3600000;
  return records.filter(row => Number.isFinite(row.reading?.observed_at_unix) && row.reading.observed_at_unix * 1000 >= start && row.reading.observed_at_unix * 1000 <= now)
    .sort((a, b) => a.reading.observed_at_unix - b.reading.observed_at_unix || a.id - b.id);
}
export function series(records, schema, field) {
  return records.filter(row => row.reading?.schema === schema && typeof row.reading.data?.[field] === 'number' && Number.isFinite(row.reading.data[field]))
    .map(row => ({ time: row.reading.observed_at_unix * 1000, value: row.reading.data[field] }));
}
export function sensorUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
