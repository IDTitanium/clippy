const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const MAX_ITEMS_PER_ROOM = 100;
const MAX_ITEM_BYTES = 200_000;
const ROOM_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '256kb' }));

const rooms = new Map();

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { items: [], clients: new Set(), lastTouched: Date.now() };
    rooms.set(code, room);
  }
  room.lastTouched = Date.now();
  return room;
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

function newRoomCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

function broadcast(room, payload, except) {
  const msg = JSON.stringify(payload);
  for (const client of room.clients) {
    if (client === except) continue;
    if (client.readyState === 1) client.send(msg);
  }
}

setInterval(() => {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [code, room] of rooms) {
    if (room.clients.size === 0 && room.lastTouched < cutoff) {
      rooms.delete(code);
    }
  }
}, 1000 * 60 * 60).unref();

app.get('/api/new-room', (_req, res) => {
  let code;
  do { code = newRoomCode(); } while (rooms.has(code));
  getRoom(code);
  res.json({ code });
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const code = (url.searchParams.get('room') || '').toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    ws.close(1008, 'invalid room');
    return;
  }

  const room = getRoom(code);
  room.clients.add(ws);

  ws.send(JSON.stringify({ type: 'init', items: room.items }));

  ws.on('message', (raw) => {
    if (raw.length > MAX_ITEM_BYTES + 1024) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    room.lastTouched = Date.now();

    if (msg.type === 'add') {
      const text = typeof msg.text === 'string' ? msg.text : '';
      if (!text || text.length > MAX_ITEM_BYTES) return;
      const item = {
        id: newId(),
        text,
        createdAt: Date.now(),
        device: typeof msg.device === 'string' ? msg.device.slice(0, 40) : 'device',
      };
      room.items.unshift(item);
      if (room.items.length > MAX_ITEMS_PER_ROOM) room.items.length = MAX_ITEMS_PER_ROOM;
      broadcast(room, { type: 'add', item });
    } else if (msg.type === 'delete') {
      const id = msg.id;
      const idx = room.items.findIndex((i) => i.id === id);
      if (idx >= 0) {
        room.items.splice(idx, 1);
        broadcast(room, { type: 'delete', id });
      }
    } else if (msg.type === 'clear') {
      room.items = [];
      broadcast(room, { type: 'clear' });
    } else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Clippy running on http://localhost:${PORT}`);
});
