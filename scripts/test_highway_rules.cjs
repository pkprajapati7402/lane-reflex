const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function testHighwayRules() {
  console.log('Starting Highway Rules Playtest...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });

  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Click Endless Survival
  await page.click('#btn-play-endless');
  await new Promise(r => setTimeout(r, 500));

  // 2. Drive forward on straight highway
  console.log('Accelerating on straight highway...');
  await page.keyboard.down('ArrowUp');
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot 1: Perfectly straight highway in pure vertical line
  await page.screenshot({ path: path.join(screenshotsDir, 'straight_vertical_road.png') });

  // 3. Overtake and steer in front of a car
  console.log('Steering to overtake...');
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, 350));
  await page.keyboard.up('ArrowRight');

  await new Promise(r => setTimeout(r, 1500));

  // Steer back in front of traffic
  console.log('Steering back into center lane ahead of traffic...');
  await page.keyboard.down('ArrowLeft');
  await new Promise(r => setTimeout(r, 350));
  await page.keyboard.up('ArrowLeft');

  // 4. BRAKE FIRMLY IN FRONT OF TRAFFIC
  console.log('Testing Scenario 1: Braking hard while in front of trailing car...');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown');
  await new Promise(r => setTimeout(r, 1200));
  await page.keyboard.up('ArrowDown');

  // Check if player is still alive (no unfair rear-end Game Over!)
  const stateAfterBrakingInFront = await page.evaluate(() => {
    const crashScreen = document.querySelector('#screen-crash');
    const hudSpeed = document.querySelector('#hud-speed-num')?.textContent;
    const isCrashVisible = crashScreen && !crashScreen.classList.contains('hidden');
    return {
      isCrashVisible,
      hudSpeed,
      score: document.querySelector('#hud-score')?.textContent,
    };
  });
  console.log('State after braking in front of traffic:', stateAfterBrakingInFront);

  // Take screenshot: player slow/braking in front of traffic without crash
  await page.screenshot({ path: path.join(screenshotsDir, 'overtaken_car_following_safely.png') });

  // 5. Accelerate again and observe traffic flow
  console.log('Accelerating again to observe traffic lane changes...');
  await page.keyboard.down('ArrowUp');
  await new Promise(r => setTimeout(r, 2500));

  const finalState = await page.evaluate(() => {
    const crashScreen = document.querySelector('#screen-crash');
    return {
      isCrashVisible: crashScreen && !crashScreen.classList.contains('hidden'),
      speed: document.querySelector('#hud-speed-num')?.textContent,
      gear: document.querySelector('#hud-gear-badge')?.textContent,
    };
  });
  console.log('Final State during cruising:', finalState);

  await page.screenshot({ path: path.join(screenshotsDir, 'traffic_overtaking_with_indicators.png') });

  await browser.close();
  console.log('Highway Rules Playtest Finished!');
}

testHighwayRules().catch(err => {
  console.error('Playtest failed:', err);
  process.exit(1);
});

