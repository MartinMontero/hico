import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';

// 04 §7 / Phase 2 item 10: Lighthouse, mobile, on the BUILT guest app, printing LCP, TBT (the stand-in for INP, which a lab
// run cannot measure) and CLS. Three runs per page, the median printed with every run. It PRINTS, it does not fail on a number:
// the thresholds are not Martin's yet (O-23). It fails only if Lighthouse cannot run. Needs `npm run build` first.
const PORT = 4174;
const BASE = `http://localhost:${PORT}`;
const PAGES = ['/p/demo-whistler/whats-on', '/p/demo-whistler/explore'];
const RUNS = 3;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] as number;

async function waitFor(url: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not answer in ${ms} ms`);
}

const seeded = spawnSync(process.execPath, ['seed/run.ts', '--local'], { stdio: 'ignore' });
if (seeded.status !== 0) throw new Error('Seeding the local database failed');

const server: ChildProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore',
  // Its own process group on Linux and macOS, so the whole tree can be stopped; Windows has taskkill for that.
  detached: process.platform !== 'win32',
  env: { ...process.env, CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true', PREVIEW_GATE: 'off', WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' },
});
const stopServer = () => {
  if (!server.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-server.pid, 'SIGTERM'); // the group started above: npx, vite and the Worker runtime
  } catch {
    server.kill('SIGTERM');
  }
};

let failed = false;
try {
  await waitFor(`${BASE}/`, 120_000);
  const rows: string[] = [];
  for (const path of PAGES) {
    const lcp: number[] = [];
    const tbt: number[] = [];
    const cls: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
      try {
        const run = await lighthouse(`${BASE}${path}`, { port: chrome.port, onlyCategories: ['performance'], logLevel: 'error' });
        const audits = run?.lhr.audits;
        if (!audits) throw new Error('Lighthouse returned no result');
        lcp.push(audits['largest-contentful-paint']?.numericValue ?? NaN);
        tbt.push(audits['total-blocking-time']?.numericValue ?? NaN);
        cls.push(audits['cumulative-layout-shift']?.numericValue ?? NaN);
      } finally {
        await chrome.kill();
      }
    }
    const fmt = (xs: number[], digits: number) => xs.map((x) => x.toFixed(digits)).join(' / ');
    rows.push(
      `${path}\n  LCP ${median(lcp).toFixed(0)} ms (runs ${fmt(lcp, 0)})\n  TBT ${median(tbt).toFixed(0)} ms (runs ${fmt(tbt, 0)})\n  CLS ${median(cls).toFixed(3)} (runs ${fmt(cls, 3)})`,
    );
    if ([...lcp, ...tbt, ...cls].some(Number.isNaN)) throw new Error(`Lighthouse gave no number for ${path}`);
  }
  console.log(`Lighthouse mobile (simulated slow 4G, 4x CPU), median of ${RUNS} runs. Printed, not enforced: the limits are not set yet (O-23).`);
  console.log(rows.join('\n'));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  failed = true;
} finally {
  stopServer();
}
process.exit(failed ? 1 : 0);