// usage: node render.cjs <out.mp4|stills> <fps> <t0> <t1> [guides]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const [out, fps = '60', t0 = '0', t1 = '1', guides] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'scene.html') + (guides ? '?guides' : ''));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  if (out === 'stills') {
    for (const t of t0.split(',')) {
      await page.evaluate(t => render(t), parseFloat(t));
      await page.screenshot({ path: `${fps}/still_${t}.png` });
    }
    await browser.close(); return;
  }
  const F = parseFloat(fps), a = Math.round(parseFloat(t0) * F), b = Math.round(parseFloat(t1) * F);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', fps, '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = a; i < b; i++) {
    await page.evaluate(t => render(t), i / F);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(out, i, '/', b);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
