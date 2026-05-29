const http = require('http');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3456;
const PKG = process.argv[2];

if (!PKG) {
    console.error('❌ Vui lòng truyền package name:');
    console.error('   node server.js com.app.live.tv.score.pro');
    process.exit(1);
}

const PREF_PATH = '/data/data/' + PKG + '/shared_prefs/nkh_ad_pref.xml';

function runAdb(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
            if (error) reject(stderr || error.message);
            else resolve(stdout.trim());
        });
    });
}

// Support dynamic package and paths
async function setOrganic(value, targetPkg) {
    const boolStr = value ? 'true' : 'false';
    const xml = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>\n    <boolean name="KEY_IS_ORGANIC" value="${boolStr}" />\n</map>\n`;
    const targetPrefPath = `/data/data/${targetPkg}/shared_prefs/nkh_ad_pref.xml`;

    // 1. Tạo file tạm trên PC
    const tempLocalPath = path.join(__dirname, 'temp_pref.xml');
    fs.writeFileSync(tempLocalPath, xml);

    await runAdb(`adb shell am force-stop ${targetPkg}`);
    
    // 2. Push file tạm lên phân vùng dùng chung trên điện thoại
    await runAdb(`adb push "${tempLocalPath}" /data/local/tmp/temp_pref.xml`);
    
    // 3. Dùng run-as sao chép file vào thư mục bảo mật của App
    await runAdb(`adb shell "run-as ${targetPkg} sh -c 'mkdir -p /data/data/${targetPkg}/shared_prefs && cp /data/local/tmp/temp_pref.xml ${targetPrefPath}'"`);
    
    // 4. Dọn dẹp file tạm
    await runAdb('adb shell rm /data/local/tmp/temp_pref.xml');
    try { fs.unlinkSync(tempLocalPath); } catch {}

    // 5. Đọc lại file để xác nhận giá trị thay đổi thành công
    const verifyContent = await runAdb(`adb shell "run-as ${targetPkg} cat ${targetPrefPath}"`);
    console.log(`[VERIFY SHAPEDPREF] File content: ${verifyContent}`);
    
    await runAdb(`adb shell am start -n ${targetPkg}/${targetPkg}.ui.component.splash.SplashActivity`);
    return boolStr + ` (File xml trên điện thoại: ${verifyContent})`;
}

async function clearData(targetPkg) {
    await runAdb(`adb shell pm clear ${targetPkg}`);
    return "Success";
}

async function getStatus(targetPkg) {
    try {
        const targetPrefPath = `/data/data/${targetPkg}/shared_prefs/nkh_ad_pref.xml`;
        const out = await runAdb(`adb shell "run-as ${targetPkg} cat ${targetPrefPath}"`);
        const match = out.match(/KEY_IS_ORGANIC.*?value="(\w+)"/);
        return match ? match[1] : 'unknown';
    } catch { return 'unknown'; }
}

async function getDevices() {
    try {
        const out = await runAdb('adb devices');
        const lines = out.split('\n').slice(1).filter(l => l.includes('device'));
        return lines.map(l => l.split('\t')[0]);
    } catch { return []; }
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    // Set CORS headers for Chrome Extension
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const targetPkg = url.searchParams.get('packageName') || PKG;

    if (url.pathname === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const status = await getStatus(targetPkg);
        const devices = await getDevices();
        res.end(JSON.stringify({ organic: status, devices }));
        return;
    }

    if (url.pathname === '/api/set') {
        const organic = url.searchParams.get('organic') === 'true';
        try {
            const result = await setOrganic(organic, targetPkg);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, organic: result }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: String(e) }));
        }
        return;
    }

    if (url.pathname === '/api/clear') {
        try {
            const result = await clearData(targetPkg);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: String(e) }));
        }
        return;
    }

    if (url.pathname === '/api/kill-server') {
        try {
            await runAdb('adb kill-server');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: String(e) }));
        }
        return;
    }

    if (url.pathname === '/webusb') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const filePath = path.join(__dirname, 'index_webusb.html');
        res.end(fs.readFileSync(filePath));
        return;
    }

    // Serve HTML
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
});

const HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ADB Ad Controller</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: #0f0f1a;
    color: #e0e0e0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    border: 1px solid #2a2a4a;
    border-radius: 20px;
    padding: 40px;
    width: 420px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  h1 {
    text-align: center;
    font-size: 22px;
    margin-bottom: 8px;
    background: linear-gradient(90deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .subtitle {
    text-align: center;
    font-size: 13px;
    color: #888;
    margin-bottom: 30px;
  }
  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    background: #12122a;
    border-radius: 12px;
    margin-bottom: 12px;
    font-size: 14px;
  }
  .status-row .label { color: #aaa; }
  .badge {
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  .badge.organic { background: #1b3a2a; color: #4ade80; }
  .badge.non-organic { background: #3a1b2a; color: #f472b6; }
  .badge.unknown { background: #2a2a2a; color: #888; }
  .badge.connected { background: #1b2a3a; color: #60a5fa; }
  .badge.disconnected { background: #3a2a1b; color: #fb923c; }
  .buttons {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }
  button {
    flex: 1;
    padding: 14px;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  button:active { transform: scale(0.97); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-on {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }
  .btn-on:hover:not(:disabled) { box-shadow: 0 4px 20px rgba(102,126,234,0.4); }
  .btn-off {
    background: linear-gradient(135deg, #2d3748, #4a5568);
    color: #e0e0e0;
  }
  .btn-off:hover:not(:disabled) { box-shadow: 0 4px 20px rgba(74,85,104,0.4); }
  .log {
    margin-top: 20px;
    padding: 12px;
    background: #0a0a18;
    border-radius: 10px;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    color: #4ade80;
    max-height: 120px;
    overflow-y: auto;
    display: none;
  }
  .spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="card">
  <h1>📱 ADB Ad Controller</h1>
  <p class="subtitle">${PKG}</p>

  <div class="status-row">
    <span class="label">Device</span>
    <span id="device-badge" class="badge unknown">checking...</span>
  </div>
  <div class="status-row">
    <span class="label">KEY_IS_ORGANIC</span>
    <span id="organic-badge" class="badge unknown">checking...</span>
  </div>

  <div class="buttons">
    <button class="btn-on" id="btn-on" onclick="setAd(false)">🟢 Bật Quảng Cáo</button>
    <button class="btn-off" id="btn-off" onclick="setAd(true)">🔴 Tắt Quảng Cáo</button>
  </div>

  <div class="log" id="log"></div>
</div>

<script>
  const logEl = document.getElementById('log');
  const deviceBadge = document.getElementById('device-badge');
  const organicBadge = document.getElementById('organic-badge');

  function log(msg) {
    logEl.style.display = 'block';
    logEl.textContent = msg + '\\n' + logEl.textContent;
  }

  async function refresh() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      if (data.devices.length > 0) {
        deviceBadge.textContent = data.devices[0];
        deviceBadge.className = 'badge connected';
      } else {
        deviceBadge.textContent = 'Không tìm thấy';
        deviceBadge.className = 'badge disconnected';
      }

      if (data.organic === 'true') {
        organicBadge.textContent = 'true (Ẩn QC)';
        organicBadge.className = 'badge organic';
      } else if (data.organic === 'false') {
        organicBadge.textContent = 'false (Hiện QC)';
        organicBadge.className = 'badge non-organic';
      } else {
        organicBadge.textContent = 'unknown';
        organicBadge.className = 'badge unknown';
      }
    } catch (e) {
      log('Lỗi kết nối server');
    }
  }

  async function setAd(organic) {
    const btn = organic ? document.getElementById('btn-off') : document.getElementById('btn-on');
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Đang xử lý...';
    log(organic ? '→ Tắt quảng cáo...' : '→ Bật quảng cáo...');

    try {
      const res = await fetch('/api/set?organic=' + organic);
      const data = await res.json();
      if (data.success) {
        log('✅ Thành công! KEY_IS_ORGANIC = ' + data.organic);
      } else {
        log('❌ Lỗi: ' + data.error);
      }
    } catch (e) {
      log('❌ Lỗi kết nối: ' + e.message);
    }

    btn.textContent = oldText;
    btn.disabled = false;
    setTimeout(refresh, 1500);
  }

  refresh();
  setInterval(refresh, 5000);
</script>
</body>
</html>`;

server.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║   📱 ADB Ad Controller is running    ║');
    console.log('  ╠══════════════════════════════════════╣');
    console.log('  ║   http://localhost:' + PORT + '              ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
});
