// Custom Next.js server with ws WebSocket support
// Runs Next.js and attaches a ws WebSocketServer on the same HTTP server.
// Dev: pnpm dev:custom
// Prod build/start: pnpm build && pnpm start:custom

import http from 'http';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach WebSocket server
  const wss = new WebSocketServer({ server });

  // Basic lobby and echo implementation as a placeholder for Tien-Len
  type Client = {
    id;
    socket;
    room?;
  };

  const clients = new Map();

  function broadcast(room | undefined, data) {
    const payload = JSON.stringify(data);
    for (const [, c] of clients) {
      if (!room || c.room === room) {
        if (c.socket.readyState === WebSocket.OPEN) c.socket.send(payload);
      }
    }
  }

  function genId() {
    return Math.random().toString(36).slice(2, 10);
  }

  wss.on('connection', (ws) => {
    const id = genId();
    const client: Client = { id, socket: ws };
    clients.set(ws, client);
    ws.send(JSON.stringify({ type: 'welcome', id }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
            break;
          }
          case 'join': {
            // join a room (game table)
            client.room = msg.room || 'lobby';
            ws.send(JSON.stringify({ type: 'joined', room: client.room }));
            broadcast(client.room, { type: 'presence', who: client.id, state: 'joined' });
            break;
          }
          case 'chat': {
            // simple chat broadcast to room
            broadcast(client.room, { type: 'chat', from: client.id, text: String(msg.text || '') });
            break;
          }
          default: {
            // echo unknown for now
            ws.send(JSON.stringify({ type: 'echo', data: msg }));
          }
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid json' }));
      }
    });

    ws.on('close', () => {
      const c = clients.get(ws);
      clients.delete(ws);
      if (c?.room) broadcast(c.room, { type: 'presence', who: c.id, state: 'left' });
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port} (dev=${dev})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
