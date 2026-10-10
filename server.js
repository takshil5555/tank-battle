// Tank Battle online server: serves the game page and relays messages between two players.
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
});
const wss = new WebSocketServer({ server });
const rooms = new Map();
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'host') {
      const r = rooms.get(m.code);
      if (r && r.host && r.host.readyState === 1) return send(ws, { t: 'err', m: 'That room code is already in use' });
      rooms.set(m.code, { host: ws, guest: null }); ws.room = m.code; ws.role = 'host';
      send(ws, { t: 'wait' });
    } else if (m.t === 'join') {
      const r = rooms.get(m.code);
      if (!r) return send(ws, { t: 'err', m: 'No room with that code' });
      if (r.guest) return send(ws, { t: 'err', m: 'That room is full' });
      r.guest = ws; ws.room = m.code; ws.role = 'guest';
      send(ws, { t: 'ready' }); send(r.host, { t: 'ready' });
    } else {
      const r = rooms.get(ws.room); if (!r) return;
      send(ws.role === 'host' ? r.guest : r.host, m);
    }
  });
  ws.on('close', () => {
    const r = rooms.get(ws.room); if (!r) return;
    if (ws.role === 'host') { send(r.guest, { t: 'left' }); rooms.delete(ws.room); }
    else { r.guest = null; send(r.host, { t: 'left' }); send(r.host, { t: 'wait' }); }
  });
});
server.listen(process.env.PORT || 3000, () => console.log('Tank Battle server running'));
