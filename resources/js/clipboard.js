const $ = (id) => document.getElementById(id);

const els = {
  roomCode: $('roomCode'),
  roomBtn: $('roomBtn'),
  status: $('status'),
  statusText: null,
  composer: $('composer'),
  input: $('input'),
  sendBtn: $('sendBtn'),
  list: $('list'),
  empty: $('empty'),
  toast: $('toast'),
  clearBtn: $('clearBtn'),
  hint: $('hint'),
};
els.statusText = els.status.querySelector('.status-text');

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

const POLL_INTERVAL_MS = 1000;

const state = {
  room: null,
  items: [],
  deviceName: getDeviceName(),
  pollTimer: null,
  inFlightPoll: null,
};

function getDeviceName() {
  const ua = navigator.userAgent;
  let name = 'Device';
  if (/iPhone/.test(ua)) name = 'iPhone';
  else if (/iPad/.test(ua)) name = 'iPad';
  else if (/Android/.test(ua)) name = 'Android';
  else if (/Macintosh|Mac OS/.test(ua)) name = 'Mac';
  else if (/Windows/.test(ua)) name = 'Windows';
  else if (/Linux/.test(ua)) name = 'Linux';
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) name += ' · Chrome';
  else if (/Firefox/.test(ua)) name += ' · Firefox';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) name += ' · Safari';
  else if (/Edg/.test(ua)) name += ' · Edge';
  return name;
}

function setStatus(stateName) {
  els.status.dataset.state = stateName;
  els.statusText.textContent =
    stateName === 'connected' ? 'live' : stateName === 'connecting' ? 'connecting' : 'offline';
}

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleString();
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function linkify(text) {
  const escaped = escapeHTML(text);
  return escaped.replace(
    /\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi,
    (m) => {
      const href = m.startsWith('http') ? m : `https://${m}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${m}</a>`;
    }
  );
}

function render() {
  if (state.items.length === 0) {
    els.empty.hidden = false;
    els.list.innerHTML = '';
    els.clearBtn.hidden = true;
    return;
  }
  els.empty.hidden = true;
  els.clearBtn.hidden = false;

  const frag = document.createDocumentFragment();
  for (const item of state.items) frag.appendChild(renderItem(item));
  els.list.replaceChildren(frag);
}

function renderItem(item) {
  const li = document.createElement('li');
  li.className = 'item';
  li.dataset.id = item.id;

  const text = document.createElement('div');
  text.className = 'item-text';
  text.innerHTML = linkify(item.text);

  const meta = document.createElement('div');
  meta.className = 'item-meta';

  const left = document.createElement('div');
  left.className = 'item-meta-left';
  const device = document.createElement('span');
  device.className = 'item-device';
  device.textContent = item.device || 'device';
  const time = document.createElement('span');
  time.className = 'item-time';
  time.textContent = timeAgo(item.createdAt);
  time.title = new Date(item.createdAt).toLocaleString();
  left.append(device, time);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'icon-btn';
  copyBtn.title = 'Copy to clipboard';
  copyBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 9h10v10H9zM5 15V5h10"/>
    </svg>
    <span>Copy</span>`;
  copyBtn.addEventListener('click', () => copyItem(item, copyBtn));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'icon-btn danger';
  delBtn.title = 'Delete';
  delBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>
    </svg>`;
  delBtn.addEventListener('click', () => deleteItem(item.id));

  actions.append(copyBtn, delBtn);
  meta.append(left, actions);
  li.append(text, meta);
  return li;
}

async function copyItem(item, btn) {
  try {
    await navigator.clipboard.writeText(item.text);
    toast('Copied to clipboard');
    if (btn) {
      const original = btn.innerHTML;
      btn.classList.add('success');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12l4 4 10-10"/>
        </svg>
        <span>Copied</span>`;
      setTimeout(() => {
        btn.classList.remove('success');
        btn.innerHTML = original;
      }, 1200);
    }
  } catch {
    const ta = document.createElement('textarea');
    ta.value = item.text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Copied'); } catch { toast('Copy failed'); }
    document.body.removeChild(ta);
  }
}

function jsonHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-CSRF-TOKEN': csrfToken,
    'X-Requested-With': 'XMLHttpRequest',
  };
}

async function apiCreateRoom() {
  const res = await fetch('/api/rooms', { method: 'POST', headers: jsonHeaders() });
  if (!res.ok) throw new Error('failed to create room');
  return res.json();
}

async function apiLoadItems(code) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/items`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error('failed to load items');
  return res.json();
}

async function apiAddItem(code, text, device) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/items`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ text, device }),
  });
  if (!res.ok) throw new Error('failed to add item');
  return res.json();
}

async function apiDeleteItem(code, id) {
  await fetch(`/api/rooms/${encodeURIComponent(code)}/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: jsonHeaders(),
  });
}

async function apiClear(code) {
  await fetch(`/api/rooms/${encodeURIComponent(code)}/items`, {
    method: 'DELETE',
    headers: jsonHeaders(),
  });
}

function addItemLocal(item) {
  if (state.items.some((i) => i.id === item.id)) return;
  state.items.unshift(item);
  if (state.items.length > 100) state.items.length = 100;
  render();
}

function removeItemLocal(id) {
  const idx = state.items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    state.items.splice(idx, 1);
    render();
  }
}

async function deleteItem(id) {
  removeItemLocal(id);
  try { await apiDeleteItem(state.room, id); } catch { toast('Delete failed'); }
}

const ROOM_STORAGE_KEY = 'clippy:room';

function readStoredRoom() {
  try {
    const stored = (localStorage.getItem(ROOM_STORAGE_KEY) || '').toUpperCase();
    return /^[A-Z0-9]{6}$/.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

function saveRoom(code) {
  try { localStorage.setItem(ROOM_STORAGE_KEY, code); } catch {}
}

async function ensureRoom() {
  const hashCode = (location.hash || '').replace(/^#/, '').toUpperCase();
  let code = /^[A-Z0-9]{6}$/.test(hashCode) ? hashCode : readStoredRoom();

  if (!code) {
    const data = await apiCreateRoom();
    code = data.code;
  }

  if (location.hash.replace(/^#/, '').toUpperCase() !== code) {
    location.hash = code;
  }

  saveRoom(code);
  state.room = code;
  els.roomCode.textContent = code;
}

async function pollOnce() {
  if (state.inFlightPoll) return state.inFlightPoll;
  state.inFlightPoll = (async () => {
    try {
      const data = await apiLoadItems(state.room);
      mergeServerItems(data.items || []);
      setStatus('connected');
    } catch {
      setStatus('disconnected');
    } finally {
      state.inFlightPoll = null;
    }
  })();
  return state.inFlightPoll;
}

function mergeServerItems(serverItems) {
  const incomingIds = new Set(serverItems.map((i) => i.id));
  let changed = state.items.length !== serverItems.length;
  if (!changed) {
    for (let i = 0; i < serverItems.length; i++) {
      if (state.items[i]?.id !== serverItems[i].id) { changed = true; break; }
    }
  }
  if (!changed) return;
  state.items = serverItems.slice(0, 100);
  render();
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (document.hidden) return;
    pollOnce();
  }, POLL_INTERVAL_MS);
}

async function submitText() {
  const text = els.input.value;
  if (!text.trim()) return;

  els.input.value = '';
  els.input.focus();

  try {
    const { item } = await apiAddItem(state.room, text, state.deviceName);
    addItemLocal(item);
  } catch {
    toast('Send failed');
  }
}

function bindEvents() {
  els.composer.addEventListener('submit', (e) => {
    e.preventDefault();
    submitText();
  });

  els.input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submitText();
    }
  });

  els.roomBtn.addEventListener('click', async () => {
    const url = `${location.origin}/#${state.room}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Room link copied — open it on your other device');
    } catch {
      toast(url);
    }
  });

  els.clearBtn.addEventListener('click', async () => {
    if (state.items.length === 0) return;
    if (!confirm('Clear all items in this room?')) return;
    state.items = [];
    render();
    try { await apiClear(state.room); } catch { toast('Clear failed'); }
  });

  window.addEventListener('hashchange', async () => {
    const next = (location.hash || '').replace(/^#/, '').toUpperCase();
    if (next && next !== state.room && /^[A-Z0-9]{6}$/.test(next)) {
      state.room = next;
      saveRoom(next);
      els.roomCode.textContent = next;
      state.items = [];
      render();
      setStatus('connecting');
      await pollOnce();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pollOnce();
  });

  setInterval(() => {
    if (state.items.length === 0) return;
    els.list.querySelectorAll('.item-time').forEach((el) => {
      const li = el.closest('.item');
      const id = li?.dataset.id;
      const item = state.items.find((i) => i.id === id);
      if (item) el.textContent = timeAgo(item.createdAt);
    });
  }, 30_000);

  if (els.hint && /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) {
    els.hint.textContent = 'Tap Send to share';
  }
}

(async function init() {
  bindEvents();
  setStatus('connecting');
  await ensureRoom();
  await pollOnce();
  startPolling();
})();
