// Local dev server for the deployed API code (worker/app.js) on Node, anime and manga routes alike:
//   node scripts/dev-api.mjs   then run Vite with API_URL=http://localhost:3002
import http from 'node:http';
import { handle } from '../worker/app.js';

const PORT = Number(process.env.PORT) || 3002;
const ctx = { waitUntil: (p) => p.catch(() => {}) };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const response = await handle(new Request(url, { method: req.method }), url.pathname || '/', ctx);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`API (worker/app.js) on http://localhost:${PORT}`));
