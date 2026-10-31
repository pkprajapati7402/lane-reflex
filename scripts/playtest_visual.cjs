const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runPlaytest() {
  console.log('Launching Puppeteer playtest...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Monitor console
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
  console.log('Page loaded. Clicking Endless Survival...');

  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Screenshot Main Menu
  await page.screenshot({ path: path.join(screenshotsDir, 'menu.png') });

  // 2. Click Endless Survival
  await page.click('#btn-play-endless');
  await new Promise(r => setTimeout(r, 600));

  // 3. Accelerate and drive forward
  console.log('Driving forward with ArrowUp...');
  await page.keyboard.down('ArrowUp');
  await new Promise(r => setTimeout(r, 2200));

  // Take screenshot driving at speed
  await page.screenshot({ path: path.join(screenshotsDir, 'driving_flow.png') });

  // 4. Steer right to weave into right lane
  console.log('Steering right into right lane...');
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, 450));
  await page.keyboard.up('ArrowRight');

  // Drive more
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(screenshotsDir, 'weaving_lane.png') });

  // 5. Steer left into center lane
  console.log('Steering left into center lane...');
  await page.keyboard.down('ArrowLeft');
  await new Promise(r => setTimeout(r, 400));
  await page.keyboard.up('ArrowLeft');

  // Keep driving and let traffic spawn continuously
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(screenshotsDir, 'continuous_traffic.png') });

  // Read HUD stats from page
  const hudState = await page.evaluate(() => {
    return {
      speed: document.querySelector('#hud-speed-num')?.textContent,
      gear: document.querySelector('#hud-gear-badge')?.textContent,
      score: document.querySelector('#hud-score')?.textContent,
      combo: document.querySelector('#hud-combo-badge')?.textContent,
      boostWidth: document.querySelector('#hud-boost-bar')?.style.width,
    };
  });
  console.log('HUD State during drive:', hudState);

  // 6. Test braking
  console.log('Testing braking with ArrowDown...');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown');
  await new Promise(r => setTimeout(r, 800));
  await page.keyboard.up('ArrowDown');

  const brakeState = await page.evaluate(() => {
    return {
      speed: document.querySelector('#hud-speed-num')?.textContent,
      gear: document.querySelector('#hud-gear-badge')?.textContent,
    };
  });
  console.log('HUD State after braking:', brakeState);

  await page.screenshot({ path: path.join(screenshotsDir, 'after_braking.png') });

  await browser.close();
  console.log('Playtest completed successfully!');
}

runPlaytest().catch(err => {
  console.error('Playtest failed:', err);
  process.exit(1);
});

