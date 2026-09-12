import { createServer as httpsServer } from 'node:https';
import { createServer as httpServer, type RequestListener } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { WebSocketServer } from 'ws';
import { RoomHub } from './rooms';
const port = Number(process.env.LAN_PORT ?? 8443);
const cert = process.env.LAN_CERT ?? '.cert/lan.pem',
  key = process.env.LAN_KEY ?? '.cert/lan-key.pem';
const insecure = process.env.LAN_HTTP === '1';
const root = resolve('dist/client');
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};
const handler: RequestListener = async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'https://localhost');
    if (url.pathname === '/api/lan') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ lan: true }));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method ?? '')) {
      res.writeHead(405).end();
      return;
    }
    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const content = await readFile(file);
    res.setHeader(
      'Content-Type',
      mime[extname(file)] ?? 'application/octet-stream',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res
      .writeHead(404)
      .end('Not found. Run npm run build before starting the LAN server.');
  }
};
try {
  const server = insecure
    ? httpServer(handler)
    : httpsServer(
        { cert: await readFile(cert), key: await readFile(key) },
        handler,
      );
  const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 }),
    hub = new RoomHub();
  server.on('upgrade', (req, socket, head) => {
    // Rooms are accessible only from the page served by this host.
    if (
      req.url !== '/room' ||
      req.headers.origin !==
        `${insecure ? 'http' : 'https'}://${req.headers.host}`
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit('connection', ws, req),
    );
  });
  wss.on('connection', (ws) => {
    let count = 0,
      last = Date.now(),
      alive = true;
    const heartbeat = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, 10000);
    ws.on('pong', () => {
      alive = true;
    });
    ws.on('message', (raw) => {
      if (Date.now() - last > 1000) {
        last = Date.now();
        count = 0;
      }
      if (++count > 120) {
        ws.close(1008, 'Too many messages');
        return;
      }
      hub.receive(
        ws,
        (Array.isArray(raw)
          ? Buffer.concat(raw)
          : Buffer.isBuffer(raw)
            ? raw
            : Buffer.from(raw)
        ).toString('utf8'),
      );
    });
    ws.on('close', () => {
      clearInterval(heartbeat);
      hub.leave(ws);
    });
    ws.on('error', () => ws.close());
  });
  server.listen(port, '0.0.0.0', () => {
    const address = server.address();
    const actualPort =
      typeof address === 'object' && address ? address.port : port;
    console.log(
      `MusicDuo LAN server: ${insecure ? 'http' : 'https'}://localhost:${actualPort}`,
    );
    for (const entries of Object.values(networkInterfaces()))
      for (const n of entries ?? [])
        if (n.family === 'IPv4' && !n.internal)
          console.log(
            `Guest URL: ${insecure ? 'http' : 'https'}://${n.address}:${actualPort}`,
          );
  });
} catch (e) {
  console.error(
    'LAN server could not start. Build the app and configure a trusted LAN certificate. See README → Remote mode.',
    e instanceof Error ? e.message : e,
  );
  process.exitCode = 1;
}
