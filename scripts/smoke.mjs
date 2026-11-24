import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const ARTIFACTS = path.join(process.cwd(), 'artifacts');
fs.mkdirSync(ARTIFACTS, { recursive: true });

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const roots = [
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    process.env.PLAYWRIGHT_BROWSERS_PATH || '',
  ].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const builds = fs
      .readdirSync(root)
      .filter((entry) => entry.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const build of builds) {
      const buildPath = path.join(root, build);
      const candidates = [
        path.join(buildPath, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        path.join(buildPath, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        path.join(buildPath, 'chrome-linux', 'chrome'),
        path.join(buildPath, 'chrome-win', 'chrome.exe'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  throw new Error('Chromium Playwright tidak ditemukan. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function hideDevOverlay(page) {
  try {
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  } catch {
    // Dev overlay only exists in development.
  }
}

async function openPage(context, label) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${label}] console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`[${label}] pageerror: ${error.message}`));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await hideDevOverlay(page);
  return { page, errors };
}

async function textOf(page) {
  return page.locator('body').innerText();
}

async function waitForTitle(page) {
  await page.getByRole('button', { name: 'Mulai balapan' }).waitFor({ state: 'visible' });
}

async function waitForRacing(page) {
  const debug = await page.evaluate(() => Boolean(window.__MOBILE_PISTON__));
  if (debug) {
    await page.waitForFunction(
      () => window.__MOBILE_PISTON__?.getMode() === 'racing',
      null,
      { timeout: 30000 },
    );
  } else {
    await page.locator('.countdown-overlay').waitFor({ state: 'hidden', timeout: 30000 });
  }
  await page.waitForTimeout(300);
}

async function checkNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  assert(metrics.documentWidth <= metrics.viewportWidth, `Overflow horizontal: ${JSON.stringify(metrics)}`);
  return metrics;
}

async function checkAccessibleButtons(page) {
  const unnamed = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .filter((button) => {
        const text = (button.innerText || '').trim();
        return !text && !button.getAttribute('aria-label') && !button.getAttribute('title');
      })
      .map((button) => button.outerHTML.slice(0, 100)),
  );
  assert(unnamed.length === 0, `Tombol tanpa nama aksesibel: ${unnamed.join(' | ')}`);
}

async function checkTapTargets(page) {
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.btn, .touch-button, .pause-button'))
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
      })
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return `${button.textContent?.trim() || button.getAttribute('aria-label')}: ${Math.round(rect.width)}x${Math.round(rect.height)}`;
      }),
  );
  assert(small.length === 0, `Target sentuh di bawah 44px: ${small.join(' | ')}`);
}

async function main() {
  const executablePath = findChromium();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=CalculateNativeWinOcclusion',
      '--enable-unsafe-swiftshader',
    ],
  });
  const allErrors = [];
  let debugAvailable = false;

  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, errors } = await openPage(desktop, 'desktop');
    allErrors.push(...errors);

    assert((await page.locator('html').getAttribute('lang')) === 'id', 'Atribut html lang bukan id.');
    assert((await page.title()).includes('Mobile Piston'), 'Judul dokumen tidak memuat Mobile Piston.');
    assert((await page.locator('h1').count()) === 1, 'Dokumen harus punya tepat satu h1.');
    await waitForTitle(page);
    await checkAccessibleButtons(page);
    await checkTapTargets(page);
    const titleMetrics = await checkNoHorizontalOverflow(page);
    assert((await textOf(page)).includes('TELUK SORE'), 'Nama lintasan tidak tampil di judul.');
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-title.png'), fullPage: true });

    await page.getByRole('button', { name: 'Kontrol' }).first().click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    assert((await textOf(page)).includes('Keyboard'), 'Dialog kontrol tidak memuat skema keyboard.');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    await page.getByRole('button', { name: /Suara:/ }).click();
    assert((await textOf(page)).toLowerCase().includes('suara: mati'), 'Tombol suara tidak berubah ke mati.');
    await page.getByRole('button', { name: /Suara:/ }).click();

    await page.getByRole('button', { name: 'Lintasan', exact: true }).click();
    await page.getByRole('heading', { name: 'Pilih lintasan' }).waitFor({ state: 'visible' });
    assert((await page.locator('.track-select-card').count()) === 2, 'Pemilih lintasan harus memuat dua rute.');
    const mataCard = page.locator('.track-select-card').filter({ hasText: 'MATA AIR' });
    await mataCard.click();
    assert((await mataCard.getAttribute('aria-pressed')) === 'true', 'MATA AIR tidak terpilih.');
    assert(await page.getByRole('button', { name: /Balapan di MATA AIR/ }).isVisible(), 'CTA lintasan MATA AIR tidak tampil.');
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-tracks.png'), fullPage: true });
    const telukCard = page.locator('.track-select-card').filter({ hasText: 'TELUK SORE' });
    await telukCard.click();
    assert((await telukCard.getAttribute('aria-pressed')) === 'true', 'TELUK SORE tidak terpilih kembali.');
    await page.getByRole('button', { name: 'Kembali' }).click();
    await waitForTitle(page);

    await page.getByRole('button', { name: 'Pilih mobil' }).click();
    await page.getByRole('heading', { name: 'Pilih mobil' }).waitFor({ state: 'visible' });
    assert((await page.locator('.car-card').count()) === 4, 'Garasi harus menampilkan empat mobil.');
    await page.getByRole('button', { name: /BAGAS/ }).click();
    assert((await page.getByRole('button', { name: /BAGAS/ }).getAttribute('aria-pressed')) === 'true', 'BAGAS tidak terpilih.');
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-garage.png'), fullPage: true });
    await page.getByRole('button', { name: 'Balapan' }).click();
    await page.getByRole('button', { name: 'Jeda balapan' }).waitFor({ state: 'visible' });
    await waitForRacing(page);
    await checkTapTargets(page);
    assert((await textOf(page)).toLowerCase().includes('putaran'), 'HUD putaran tidak tampil setelah countdown.');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-race.png'), fullPage: true });
    const gameCanvas = page.locator('.game-canvas');
    assert((await gameCanvas.getAttribute('data-camera-mode')) === 'top', 'Kamera awal bukan top.');
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-race-top.png'), fullPage: true });
    await page.getByRole('button', { name: 'Ganti sudut kamera' }).click();
    await page.waitForTimeout(180);
    assert((await gameCanvas.getAttribute('data-camera-mode')) === 'chase', 'Tombol kamera tidak beralih ke chase.');
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-race.png'), fullPage: true });
    await page.getByRole('button', { name: 'Ganti sudut kamera' }).click();
    await page.waitForTimeout(700);
    assert((await gameCanvas.getAttribute('data-camera-mode')) === 'cockpit', 'Tombol kamera tidak beralih ke cockpit.');
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-race-cockpit.png'), fullPage: true });
    await page.getByRole('button', { name: 'Ganti sudut kamera' }).click();
    await page.waitForTimeout(180);
    assert((await gameCanvas.getAttribute('data-camera-mode')) === 'top', 'Tombol kamera tidak kembali ke top.');

    const nitroBefore = await page.getByRole('meter', { name: 'Meter nitro' }).getAttribute('aria-valuenow');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(420);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('Space');
    await page.waitForTimeout(520);
    await page.keyboard.up('Space');
    const nitroAfter = await page.getByRole('meter', { name: 'Meter nitro' }).getAttribute('aria-valuenow');
    assert(Number(nitroAfter) < Number(nitroBefore), `Nitro tidak turun: ${nitroBefore} -> ${nitroAfter}`);

    const padInjected = await page.evaluate(() => {
      const fake = {
        id: 'Smoke Pad',
        index: 0,
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
        timestamp: 0,
      };
      fake.buttons[7] = { pressed: true, touched: true, value: 1 };
      try {
        Object.defineProperty(navigator, 'getGamepads', { value: () => [fake], configurable: true });
        window.__SMOKE_PAD__ = fake;
        return true;
      } catch {
        return false;
      }
    });
    if (padInjected) {
      const gamepadBefore = Number(await page.getByRole('meter', { name: 'Meter nitro' }).getAttribute('aria-valuenow'));
      await page.waitForTimeout(650);
      const gamepadAfter = Number(await page.getByRole('meter', { name: 'Meter nitro' }).getAttribute('aria-valuenow'));
      assert(gamepadAfter < gamepadBefore, `Nitro gamepad tidak turun: ${gamepadBefore} -> ${gamepadAfter}`);
      await page.evaluate(() => {
        if (window.__SMOKE_PAD__) {
          window.__SMOKE_PAD__.buttons[7] = { pressed: false, touched: false, value: 0 };
          window.__SMOKE_PAD__.axes = [0, 0, 0, 0];
        }
      });
    }

    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-race-action.png'), fullPage: true });

    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    assert((await textOf(page)).toLowerCase().includes('jeda'), 'Dialog jeda tidak terbuka dengan Escape.');
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    debugAvailable = await page.evaluate(() => Boolean(window.__MOBILE_PISTON__));
    if (debugAvailable) {
      const finished = await page.evaluate(() => window.__MOBILE_PISTON__.finishRace());
      assert(finished === true, 'Debug finish gagal.');
      await page.getByRole('heading', { name: 'Hasil balapan' }).waitFor({ state: 'visible' });
      assert((await page.locator('.results-table tbody tr').count()) === 6, 'Hasil harus memuat enam finisher.');
      const resultsText = await textOf(page);
      assert(resultsText.includes('Waktu total'), 'Ringkasan waktu tidak tampil.');
      assert(resultsText.includes('Kamu'), 'Baris pemain tidak ditandai.');
      if (await page.getByText('Rekor putaran baru tersimpan di perangkat ini.').count()) {
        assert(true, 'Rekor baru tercatat.');
      }
      await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-results.png'), fullPage: true });
      const saved = await page.evaluate(() => localStorage.getItem('mobile-piston.save.v2'));
      assert(saved && JSON.parse(saved).bestLapMs['teluk-sore'] > 0, 'Rekor tidak tersimpan.');
      await page.getByRole('button', { name: 'Menu utama' }).click();
      await waitForTitle(page);
      assert(!(await textOf(page)).toLowerCase().includes('belum ada'), 'Rekor tidak tampil di judul.');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      assert(!(await textOf(page)).toLowerCase().includes('belum ada'), 'Rekor tidak bertahan setelah reload.');

      await page.getByRole('button', { name: /Pilih lintasan/ }).click();
      await page.locator('.track-select-card').filter({ hasText: 'MATA AIR' }).click();
      await page.getByRole('button', { name: /Balapan di MATA AIR/ }).click();
      await waitForRacing(page);
      assert((await page.evaluate(() => window.__MOBILE_PISTON__.getDebugState().track)) === 'mata-air', 'Mesin tidak memakai lintasan MATA AIR.');
      await page.evaluate(() => window.__MOBILE_PISTON__.finishRace());
      await page.getByRole('heading', { name: 'Hasil balapan' }).waitFor({ state: 'visible' });
      assert((await textOf(page)).includes('MATA AIR'), 'Hasil tidak menyebut MATA AIR.');
      await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-mata-air-results.png'), fullPage: true });
      const savedBoth = await page.evaluate(() => localStorage.getItem('mobile-piston.save.v2'));
      assert(savedBoth && JSON.parse(savedBoth).bestLapMs['mata-air'] > 0, 'Rekor MATA AIR tidak tersimpan.');
      await page.getByRole('button', { name: 'Menu utama' }).click();
      await waitForTitle(page);
      assert((await textOf(page)).includes('MATA AIR'), 'Lintasan MATA AIR tidak tersimpan sebagai pilihan.');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      assert(!(await textOf(page)).toLowerCase().includes('belum ada'), 'Rekor MATA AIR tidak bertahan setelah reload.');

      await page.evaluate(() =>
        localStorage.setItem('mobile-piston.save.v2', '{"version":2,"selectedCarId":"rocket","selectedTrackId":"moon","bestLapMs":{"teluk-sore":-2},"audioMuted":"no"}'),
      );
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await waitForTitle(page);
      assert((await textOf(page)).includes('SIRIP'), 'Save rusak tidak kembali ke mobil default.');
      assert((await textOf(page)).includes('TELUK SORE'), 'Save rusak tidak kembali ke lintasan default.');
    }

    await desktop.close();

    const landscape = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const mobile = await openPage(landscape, 'landscape');
    allErrors.push(...mobile.errors);
    await checkNoHorizontalOverflow(mobile.page);
    await checkTapTargets(mobile.page);
    const startBox = await mobile.page.getByRole('button', { name: 'Mulai balapan' }).boundingBox();
    assert(startBox && startBox.y + startBox.height <= 390, 'CTA mulai terpotong di lanskap pendek.');
    await mobile.page.screenshot({ path: path.join(ARTIFACTS, 'landscape-title.png'), fullPage: true });
    await mobile.page.getByRole('button', { name: 'Mulai balapan' }).click();
    await mobile.page.getByRole('button', { name: 'Jeda balapan' }).waitFor({ state: 'visible' });
    await waitForRacing(mobile.page);
    await checkTapTargets(mobile.page);
    assert(await mobile.page.getByRole('button', { name: 'Belok kiri' }).isVisible(), 'Kontrol sentuh tidak muncul.');
    const touchNitro = mobile.page.getByRole('button', { name: 'Nitro', exact: true });
    const beforeTouch = Number(await mobile.page.getByRole('meter', { name: 'Meter nitro' }).getAttribute('aria-valuenow'));
    const box = await touchNitro.boundingBox();
    assert(box, 'Tombol nitro sentuh tidak punya bounding box.');
    await mobile.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await mobile.page.mouse.down();
    await mobile.page.waitForTimeout(450);
    assert((await touchNitro.getAttribute('data-active')) === 'true', 'Tombol nitro tidak aktif saat ditekan.');
    await mobile.page.screenshot({ path: path.join(ARTIFACTS, 'landscape-race.png'), fullPage: true });
    await mobile.page.mouse.up();
    const afterTouch = Number(await mobile.page.getByRole('meter', { name: 'Meter nitro' }).getAttribute('aria-valuenow'));
    assert(afterTouch < beforeTouch, `Nitro sentuh tidak turun: ${beforeTouch} -> ${afterTouch}`);
    await checkNoHorizontalOverflow(mobile.page);
    await landscape.close();

    const portrait = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const narrow = await openPage(portrait, 'portrait');
    allErrors.push(...narrow.errors);
    await checkNoHorizontalOverflow(narrow.page);
    await narrow.page.screenshot({ path: path.join(ARTIFACTS, 'portrait-title.png'), fullPage: true });
    await narrow.page.getByRole('button', { name: 'Mulai balapan' }).click();
    await narrow.page.getByRole('button', { name: 'Jeda balapan' }).waitFor({ state: 'visible' });
    await waitForRacing(narrow.page);
    assert(await narrow.page.getByRole('button', { name: 'Belok kiri' }).isVisible(), 'Kontrol sentuh potret tidak muncul.');
    await narrow.page.screenshot({ path: path.join(ARTIFACTS, 'portrait-race.png'), fullPage: true });
    await checkNoHorizontalOverflow(narrow.page);
    await portrait.close();

    for (const size of [
      { width: 360, height: 640, label: 'small-portrait' },
      { width: 1920, height: 1080, label: 'wide-desktop' },
      { width: 768, height: 1024, label: 'tablet' },
    ]) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
      const extra = await openPage(context, size.label);
      allErrors.push(...extra.errors);
      await checkNoHorizontalOverflow(extra.page);
      await checkTapTargets(extra.page);
      const startButton = extra.page.getByRole('button', { name: 'Mulai balapan' });
      assert(await startButton.isVisible(), `CTA tidak terlihat di ${size.label}.`);
      await context.close();
    }

    const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const reducedPage = await openPage(reduced, 'reduced-motion');
    allErrors.push(...reducedPage.errors);
    assert(
      await reducedPage.page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      'Emulasi reduced motion tidak aktif.',
    );
    await reduced.close();

    const noWebgl = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const noWebglPage = await noWebgl.newPage();
    await noWebglPage.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (String(type).startsWith('webgl')) return null;
        return original.call(this, type, ...args);
      };
    });
    await noWebglPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await noWebglPage.getByRole('heading', { name: 'Game gagal dimuat' }).waitFor({ state: 'visible', timeout: 30000 });
    assert(
      (await noWebglPage.locator('body').innerText()).includes('WebGL tidak tersedia'),
      'Error state WebGL tidak menjelaskan penyebabnya.',
    );
    await noWebglPage.screenshot({ path: path.join(ARTIFACTS, 'error-webgl.png'), fullPage: true });
    await noWebgl.close();

    const notFound = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const notFoundPage = await notFound.newPage();
    await notFoundPage.goto(`${BASE_URL}/lintasan-yang-tidak-ada`, { waitUntil: 'networkidle' });
    await notFoundPage.getByText('404 / di luar garis').waitFor({ state: 'visible', timeout: 30000 });
    await notFoundPage.screenshot({ path: path.join(ARTIFACTS, 'not-found.png'), fullPage: true });
    await notFound.close();

    assert(allErrors.length === 0, allErrors.join('\n'));
    console.log('Smoke test PASS');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Debug results checked: ${debugAvailable ? 'yes' : 'no (production build)'}`);
    console.log(`Screenshots: ${ARTIFACTS}`);
    console.log(`Title viewport: ${titleMetrics.viewportWidth}x${titleMetrics.viewportHeight}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Smoke test FAIL');
  console.error(error);
  process.exitCode = 1;
});
