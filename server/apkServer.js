import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8090;
const ALT_PORT = 8088;
const APK_PATH = path.resolve(__dirname, '../android/app/build/outputs/apk/debug/app-debug.apk');

function handleRequest(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  if (req.url === '/app-debug.apk' || req.url === '/download-apk') {
    if (!fs.existsSync(APK_PATH)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('APK file not found. Please build the project first.');
      return;
    }
    const stat = fs.statSync(APK_PATH);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="LIGTAS-debug.apk"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    fs.createReadStream(APK_PATH).pipe(res);
    return;
  }

  // Mobile-friendly download landing page
  let stat = null;
  try {
    if (fs.existsSync(APK_PATH)) {
      stat = fs.statSync(APK_PATH);
    }
  } catch (err) {
    console.error('Error stating APK:', err);
  }

  const sizeMb = stat ? (stat.size / (1024 * 1024)).toFixed(2) : 'Unknown';
  const modified = stat ? stat.mtime.toLocaleString() : 'Unknown';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LIGTAS Metro - Android APK Download</title>
  <style>
    body {
      background-color: #101114;
      color: #f5f6f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      background-color: #17181d;
      border: 1px solid #262831;
      border-radius: 20px;
      padding: 32px 24px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    }
    h1 {
      font-size: 22px;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    p {
      color: #8c909d;
      font-size: 14px;
      line-height: 1.5;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .meta {
      background-color: #121316;
      border: 1px solid #23252e;
      border-radius: 12px;
      padding: 12px;
      font-size: 13px;
      color: #c4c7d2;
      text-align: left;
      margin-bottom: 24px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .meta-row:last-child {
      margin-bottom: 0;
    }
    .meta-label {
      color: #707482;
    }
    .btn {
      display: block;
      background: linear-gradient(135deg, #54b2d3, #3895b3);
      color: #101114;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      padding: 14px 20px;
      border-radius: 14px;
      transition: transform 0.15s ease, background 0.15s ease;
    }
    .btn:active {
      transform: scale(0.98);
      background: #3895b3;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>LIGTAS METRO</h1>
    <p>Metro Manila Flood-Safe Commute & Bypass Radar</p>
    <div class="meta">
      <div class="meta-row">
        <span class="meta-label">Package:</span>
        <span>com.ligtas.app</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Build:</span>
        <span>Debug APK (Phases 1-3)</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Size:</span>
        <span>${sizeMb} MB</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Compiled:</span>
        <span>${modified}</span>
      </div>
    </div>
    <a href="/app-debug.apk" class="btn">Download APK</a>
  </div>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
  </script>
</body>
</html>`;

  res.writeHead(200, { 
    'Content-Type': 'text/html; charset=utf-8',
    'Clear-Site-Data': '"cache", "storage"',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  res.end(html);
}

const server1 = http.createServer(handleRequest);
server1.listen(PORT, '0.0.0.0', () => {
  console.log(`LIGTAS APK distribution server listening on http://0.0.0.0:${PORT}`);
});

const server2 = http.createServer(handleRequest);
server2.listen(ALT_PORT, '0.0.0.0', () => {
  console.log(`LIGTAS APK distribution server listening on http://0.0.0.0:${ALT_PORT}`);
});
