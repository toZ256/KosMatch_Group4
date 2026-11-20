/**
 * KosMatch Jakarta - Local Website & Service Monitoring Tool
 * 
 * Monitors local frontend, API health, and database query endpoints.
 * Tracks uptime percentage, latency (ms), HTTP status codes, and alerts on failure.
 * 
 * Usage:
 *   pnpm monitor          (Continuous monitoring loop)
 *   pnpm monitor --once   (Single-run health check report)
 */

interface MonitorTarget {
  name: string;
  url: string;
  expectedStatus: number;
  critical: boolean;
}

interface TargetStats {
  checks: number;
  passes: number;
  failures: number;
  consecutiveFailures: number;
  latencies: number[];
  lastStatus: 'UP' | 'DOWN' | 'SLOW' | 'PENDING';
  lastStatusCode?: number;
  lastLatencyMs?: number;
  lastError?: string;
  lastChecked?: string;
}

const TARGETS: MonitorTarget[] = [
  {
    name: 'Frontend Web (Vite SPA)',
    url: process.env.VITE_URL || 'http://localhost:5173',
    expectedStatus: 200,
    critical: true,
  },
  {
    name: 'Backend API Healthcheck',
    url: (process.env.API_URL || 'http://localhost:4000') + '/api/health',
    expectedStatus: 200,
    critical: true,
  },
  {
    name: 'Backend Data Query (Kos API)',
    url: (process.env.API_URL || 'http://localhost:4000') + '/api/kos?limit=1',
    expectedStatus: 200,
    critical: false,
  },
];

const SLOW_THRESHOLD_MS = 1000;
const CHECK_INTERVAL_MS = parseInt(process.env.MONITOR_INTERVAL_MS || '5000', 10);
const ONCE = process.argv.includes('--once');
const WEBHOOK_URL = process.env.MONITOR_WEBHOOK_URL;

const stats: Record<string, TargetStats> = {};

for (const target of TARGETS) {
  stats[target.name] = {
    checks: 0,
    passes: 0,
    failures: 0,
    consecutiveFailures: 0,
    latencies: [],
    lastStatus: 'PENDING',
  };
}

// ANSI colors for clean terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m\x1b[37m',
};

async function sendWebhookAlert(targetName: string, status: 'DOWN' | 'RECOVERED', details: string) {
  if (!WEBHOOK_URL) return;
  try {
    const isDiscord = WEBHOOK_URL.includes('discord.com');
    const payload = isDiscord
      ? {
          content: status === 'DOWN' ? `🚨 **[ALERT] Service Down!**` : `✅ **[RECOVERED] Service Normal**`,
          embeds: [
            {
              title: `${targetName} is ${status}`,
              description: details,
              color: status === 'DOWN' ? 15158332 : 3066993,
              timestamp: new Date().toISOString(),
            },
          ],
        }
      : {
          text: `[KosMatch Monitor] ${targetName} is ${status}: ${details}`,
        };

    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`Failed to send webhook alert: ${(err as Error).message}`);
  }
}

async function checkTarget(target: MonitorTarget): Promise<void> {
  const stat = stats[target.name];
  stat.checks++;
  stat.lastChecked = new Date().toLocaleTimeString();

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(target.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'KosMatch-Local-Monitor/1.0' },
    });
    clearTimeout(timeout);

    const latency = Math.round(performance.now() - start);
    stat.latencies.push(latency);
    if (stat.latencies.length > 50) stat.latencies.shift();
    stat.lastLatencyMs = latency;
    stat.lastStatusCode = res.status;

    if (res.status === target.expectedStatus) {
      stat.passes++;
      if (stat.consecutiveFailures > 0) {
        sendWebhookAlert(target.name, 'RECOVERED', `Service kembali online dalam respon ${latency}ms (HTTP ${res.status}).`);
      }
      stat.consecutiveFailures = 0;
      stat.lastStatus = latency > SLOW_THRESHOLD_MS ? 'SLOW' : 'UP';
      stat.lastError = undefined;
    } else {
      stat.failures++;
      stat.consecutiveFailures++;
      stat.lastStatus = 'DOWN';
      stat.lastError = `Status ${res.status} != ${target.expectedStatus}`;
      if (stat.consecutiveFailures === 1) {
        sendWebhookAlert(target.name, 'DOWN', `Respon HTTP tidak sesuai: ${res.status} (diharapkan ${target.expectedStatus}).`);
      }
    }
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    stat.failures++;
    stat.consecutiveFailures++;
    stat.lastLatencyMs = latency;
    stat.lastStatusCode = 0;
    stat.lastStatus = 'DOWN';
    const msg = (error as Error).name === 'AbortError' ? 'Connection Timeout (>8s)' : ((error as Error).message || 'Connection Refused');
    stat.lastError = msg;

    if (stat.consecutiveFailures === 1) {
      sendWebhookAlert(target.name, 'DOWN', `Gagal terhubung: ${msg}`);
    }
  }
}

function renderDashboard(iteration: number) {
  // Clear screen or log clean block
  console.log('\n' + colors.bold + colors.bgBlue + '  === KOSMATCH WEBSITE & LOCAL SERVICE MONITOR ===  ' + colors.reset);
  console.log(
    colors.gray +
      `Waktu: ${new Date().toLocaleString()} | Iterasi: #${iteration} | Interval: ${CHECK_INTERVAL_MS / 1000}s` +
      colors.reset
  );
  console.log(colors.gray + '─────────────────────────────────────────────────────────────────────────────' + colors.reset);

  for (const target of TARGETS) {
    const s = stats[target.name];
    const uptimePct = s.checks > 0 ? ((s.passes / s.checks) * 100).toFixed(1) : '0.0';
    const avgLatency =
      s.latencies.length > 0 ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length) : 0;

    let badge = `${colors.bold}${colors.green}[ ONLINE ]${colors.reset}`;
    if (s.lastStatus === 'DOWN') {
      badge = `${colors.bold}${colors.red}[ OFFLINE ]${colors.reset}`;
    } else if (s.lastStatus === 'SLOW') {
      badge = `${colors.bold}${colors.yellow}[ SLOW ]${colors.reset}`;
    } else if (s.lastStatus === 'PENDING') {
      badge = `${colors.bold}${colors.gray}[ PENDING ]${colors.reset}`;
    }

    console.log(
      `${badge} ${colors.bold}${target.name.padEnd(30)}${colors.reset} ` +
        `Uptime: ${uptimePct}% | Latency: ${s.lastLatencyMs ?? 0}ms (avg: ${avgLatency}ms) | HTTP: ${s.lastStatusCode ?? '-'}`
    );
    console.log(colors.gray + `         URL: ${target.url}` + colors.reset);

    if (s.lastError) {
      console.log(colors.red + `         Error: ${s.lastError}` + colors.reset);
    }
  }

  console.log(colors.gray + '─────────────────────────────────────────────────────────────────────────────' + colors.reset);
  if (!ONCE) {
    console.log(colors.cyan + 'Tekan Ctrl+C untuk menghentikan pemantauan.' + colors.reset);
  }
}

async function run() {
  let iteration = 1;
  const loop = async () => {
    await Promise.all(TARGETS.map((t) => checkTarget(t)));
    renderDashboard(iteration);
    iteration++;

    if (!ONCE) {
      setTimeout(loop, CHECK_INTERVAL_MS);
    }
  };

  await loop();
}

run();
