// Tank Battle online server: serves the game page and relays messages for up to 4 players per room.
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
});
const wss = new WebSocketServer({ server });
const rooms = new Map();   // code -> { host, guests: [slot1, slot2, slot3] }
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'host') {
      const r = rooms.get(m.code);
      if (r && r.host && r.host.readyState === 1) return send(ws, { t: 'err', m: 'That room code is already in use' });
      rooms.set(m.code, { host: ws, guests: [null, null, null] }); ws.room = m.code; ws.role = 'host';
      send(ws, { t: 'wait' });
    } else if (m.t === 'join') {
      const r = rooms.get(m.code);
      if (!r) return send(ws, { t: 'err', m: 'No room with that code' });
      const idx = r.guests.findIndex(g => !g || g.readyState !== 1);
      if (idx < 0) return send(ws, { t: 'err', m: 'That room is full (4 players)' });
      r.guests[idx] = ws; ws.room = m.code; ws.role = 'guest'; ws.slot = idx + 1;
      send(ws, { t: 'ready', slot: ws.slot }); send(r.host, { t: 'join', slot: ws.slot });
    } else {
      const r = rooms.get(ws.room); if (!r) return;
      if (ws.role === 'host') r.guests.forEach(g => send(g, m));
      else send(r.host, Object.assign({}, m, { slot: ws.slot }));
    }
  });
  ws.on('close', () => {
    const r = rooms.get(ws.room); if (!r) return;
    if (ws.role === 'host') { r.guests.forEach(g => send(g, { t: 'left' })); rooms.delete(ws.room); }
    else { r.guests[ws.slot - 1] = null; send(r.host, { t: 'leave', slot: ws.slot }); }
  });
});
server.listen(process.env.PORT || 3000, () => console.log('Tank Battle server running'));
