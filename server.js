
const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HC_URL = process.env.HEALTHCHECKS_URL || '';
const PING_MS = 60_000; 

function safePing(url) {
  if (!url) return;
  try {

    fetch(url).catch(() => {});
  } catch (_) {}
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SIT774 app\n');
});

server.listen(PORT, () => {
  console.log(`listening on :${PORT}`);
  if (HC_URL) safePing(`${HC_URL}/start`);       // signal start
  if (HC_URL) setInterval(() => safePing(HC_URL), PING_MS); // heartbeat
});


function signalFailAndExit(code) {
  if (HC_URL) safePing(`${HC_URL}/fail`);
  setTimeout(() => process.exit(code), 100);
}
process.on('SIGTERM', () => server.close(() => signalFailAndExit(0)));
process.on('SIGINT',  () => server.close(() => signalFailAndExit(0)));
process.on('uncaughtException', () => signalFailAndExit(1));
process.on('unhandledRejection', () => signalFailAndExit(1));
