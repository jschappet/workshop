const $ = id => document.getElementById(id);
const ready = new Promise(resolve => {
  if (window.Alpine?.store('api')) resolve();
  else document.addEventListener('alpine:initialized', resolve, { once: true });
});
let rows = [], cursor = null, busy = false;
const date = value => new Date(value * 1000).toLocaleString();
function node(tag, text) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
}
function message(text) { $('enrollment-status').textContent = text; }
async function call(name, params = {}, body = null) {
  await ready;
  return Alpine.store('api').call(name, params, body, { headers: { 'X-IoT-Admin': '1' } });
}
function setBusy(value) {
  busy = value;
  $('refresh-enrollments').disabled = value;
  $('more-enrollments').disabled = value;
  for (const button of $('enrollments').querySelectorAll('button')) button.disabled = value;
}
function render() {
  $('enrollments').replaceChildren();
  for (const row of rows) {
    const card = node('article'); card.className = 'metric-card';
    card.append(node('h2', `${row.metadata.name} · ${row.device_id}`), node('p', `Enrollment #${row.id} · ${row.status} · ${date(row.created_at_unix)}`));
    const metadata = node('details'); metadata.append(node('summary', 'Device metadata'), node('pre', JSON.stringify(row.metadata, null, 2))); card.append(metadata);
    const samples = node('details'); samples.open = row.status === 'provisional';
    samples.append(node('summary', `${row.samples.length} of 5 provisional samples`));
    for (const sample of row.samples) samples.append(node('p', `Received ${date(sample.received_at_unix)}`), node('pre', JSON.stringify(sample.reading, null, 2)));
    if (!row.samples.length) samples.append(node('p', 'No sample readings received yet.'));
    card.append(samples);
    if (row.status === 'provisional') {
      if (row.replaces_enrollment_id !== null) card.append(node('p', `Approval will replace enrollment #${row.replaces_enrollment_id}. The old credential will be revoked; historical readings remain.`));
      const approve = node('button', row.replaces_enrollment_id === null ? 'Approve device' : 'Approve replacement'); approve.type = 'button';
      approve.addEventListener('click', () => decide(row, 'approve', row.replaces_enrollment_id === null ? '' : String(row.replaces_enrollment_id))); card.append(approve);
    }
    if (row.status !== 'revoked') {
      const revoke = node('button', 'Revoke credential'); revoke.type = 'button';
      revoke.addEventListener('click', () => decide(row, 'revoke', '')); card.append(revoke);
    }
    const audit = node('details'); audit.append(node('summary', 'Approval history'));
    for (const event of row.events) audit.append(node('p', `${date(event.created_at_unix)} · ${event.action} · administrator #${event.actor_user_id}`));
    card.append(audit); $('enrollments').append(card);
  }
  $('more-enrollments').hidden = cursor === null;
}
async function load(more = false) {
  if (busy) return;
  setBusy(true); message('Loading enrollments…');
  try {
    const page = await call('iot_enrollments', more ? { before_id: cursor } : {});
    rows = more ? [...rows, ...page.enrollments] : page.enrollments;
    cursor = page.next_before_id; render();
    message(rows.length ? 'Review metadata and samples before approving a device.' : 'No device enrollments yet.');
  } catch (error) {
    rows = []; cursor = null; render();
    message(error.status === 401 ? 'Sign in to manage devices.' : error.status === 403 ? 'Administrator access for this host is required.' : 'Unable to load enrollments. Please retry.');
  } finally { setBusy(false); }
}
async function decide(row, action, replacement) {
  if (busy) return;
  const replaces = replacement === '' ? null : Number(replacement);
  if (replaces !== null && (!Number.isSafeInteger(replaces) || replaces <= 0)) { message('Enter a valid replacement enrollment ID.'); return; }
  const prompt = action === 'revoke' ? `Revoke enrollment #${row.id}? Uploads will stop; historical readings remain.` : replaces !== null ? `Approve enrollment #${row.id} and replace credential #${replaces}? The old credential will stop working.` : `Approve enrollment #${row.id} based on its metadata and samples?`;
  if (!window.confirm(prompt)) return;
  setBusy(true);
  try {
    await call('iot_enrollment_decide', { id: row.id }, { action, replaces });
    setBusy(false); await load();
    message(action === 'approve' ? 'Device approved. It will resume on its next check, within three hours while online.' : 'Credential revoked. Historical readings are retained.');
  } catch (error) {
    message(error.status === 409 ? 'Approval conflict: check the current enrollment ID for replacement, or conflicting sample report IDs. Refresh before retrying.' : 'Unable to save this decision. Check your admin access and retry.');
  } finally { setBusy(false); }
}
$('refresh-enrollments').addEventListener('click', () => load());
$('more-enrollments').addEventListener('click', () => load(true));
load();
