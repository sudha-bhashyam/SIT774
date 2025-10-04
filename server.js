const http = require('http');
const port = process.env.PORT || 3000;

const HC_URL = process.env.HEALTHCHECKS_URL;
const PING_EVERY_MS = 60 * 1000; // must be less than your Healthchecks period

function safePing(url) {
  if (!url) return;
  // Node 18 has global fetch
  fetch(url).catch(() => {/* ignore so app never crashes from ping */});
}

const server = app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);

  if (HC_URL) safePing(`${HC_URL}/start`); // signal start

  if (HC_URL) {
    setInterval(() => safePing(HC_URL), PING_EVERY_MS); // regular heartbeat
  }
});

// send fail on crash/shutdown
function signalFailAndExit(code) {
  if (HC_URL) safePing(`${HC_URL}/fail`);
  setTimeout(() => process.exit(code), 100);
}
process.on('SIGTERM', () => server.close(() => signalFailAndExit(0)));
process.on('SIGINT', () => server.close(() => signalFailAndExit(0)));
process.on('uncaughtException', () => signalFailAndExit(1));
process.on('unhandledRejection', () => signalFailAndExit(1));

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ status: 'ok' }));
  }
  res.writeHead(200, {'Content-Type':'text/plain'});
  res.end('SIT774 app\n');
});
server.listen(port, () => console.log(`listening on :${port}`));
