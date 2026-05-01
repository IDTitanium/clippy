(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    roomCode: $('roomCode'),
    roomBtn: $('roomBtn'),
    status: $('status'),
    statusText: $('status').querySelector('.status-text'),
    composer: $('composer'),
    input: $('input'),
    sendBtn: $('sendBtn'),
    list: $('list'),
    empty: $('empty'),
    toast: $('toast'),
    clearBtn: $('clearBtn'),
    hint: $('hint'),
  };

  const state = {
    room: null,
    ws: null,
    items: [],
    deviceName: getDeviceName(),
    reconnectDelay: 1000,
    reconnectTimer: null,
    pingTimer: null,
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

  function setStatus(state) {
    els.status.dataset.state = state;
    els.statusText.textContent =
      state === 'connected' ? 'live' : state === 'connecting' ? 'connecting' : 'offline';
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
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
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
    for (const item of state.items) {
      frag.appendChild(renderItem(item));
    }
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

  function deleteItem(id) {
    const li = els.list.querySelector(`[data-id="${id}"]`);
    if (li) li.classList.add('removing');
    send({ type: 'delete', id });
  }

  function send(msg) {
    if (state.ws && state.ws.readyState === 1) {
      state.ws.send(JSON.stringify(msg));
    }
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

  async function ensureRoom() {
    let code = (location.hash || '').replace(/^#/, '').toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      const res = await fetch('/api/new-room');
      const data = await res.json();
      code = data.code;
      location.hash = code;
    }
    state.room = code;
    els.roomCode.textContent = code;
  }

  function connect() {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    setStatus('connecting');
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/?room=${encodeURIComponent(state.room)}`);
    state.ws = ws;

    ws.addEventListener('open', () => {
      setStatus('connected');
      state.reconnectDelay = 1000;
      clearInterval(state.pingTimer);
      state.pingTimer = setInterval(() => send({ type: 'ping' }), 25_000);
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'init') {
        state.items = msg.items || [];
        render();
      } else if (msg.type === 'add') {
        addItemLocal(msg.item);
      } else if (msg.type === 'delete') {
        removeItemLocal(msg.id);
      } else if (msg.type === 'clear') {
        state.items = [];
        render();
      }
    });

    ws.addEventListener('close', () => {
      setStatus('disconnected');
      clearInterval(state.pingTimer);
      state.reconnectTimer = setTimeout(connect, state.reconnectDelay);
      state.reconnectDelay = Math.min(state.reconnectDelay * 1.6, 10_000);
    });

    ws.addEventListener('error', () => {
      try { ws.close(); } catch {}
    });
  }

  function submitText() {
    const text = els.input.value;
    if (!text.trim()) return;
    send({ type: 'add', text, device: state.deviceName });
    els.input.value = '';
    els.input.focus();
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

    els.clearBtn.addEventListener('click', () => {
      if (state.items.length === 0) return;
      if (!confirm('Clear all items in this room?')) return;
      send({ type: 'clear' });
    });

    window.addEventListener('hashchange', () => {
      const next = (location.hash || '').replace(/^#/, '').toUpperCase();
      if (next && next !== state.room && /^[A-Z0-9]{6}$/.test(next)) {
        state.room = next;
        els.roomCode.textContent = next;
        if (state.ws) try { state.ws.close(); } catch {}
        state.items = [];
        render();
        connect();
      }
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
    await ensureRoom();
    render();
    connect();
  })();
})();
