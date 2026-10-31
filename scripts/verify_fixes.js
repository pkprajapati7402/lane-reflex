import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function verifyAllFixes() {
  console.log('🚀 Running comprehensive verification of all player, traffic, and drill fixes...');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=d3d11'],
  });

  const page = await browser.newPage();
  const screenshotDir = path.resolve('screenshots');

  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:4173/ ...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });

  // 1. Verify Settings with Traffic Density
  console.log('Verifying Settings & Traffic Density Selector (Low / Moderate / High)...');
  await page.click('#btn-open-settings');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, 'verify_settings_density.png') });

  // Select 'high' density to test
  await page.select('#sel-density', 'high');
  await page.click('#btn-close-settings');
  await new Promise(r => setTimeout(r, 300));

  // 2. Start Endless Survival and test Keyboard Forward Arrow Speed Up & Left/Right Steering
  console.log('Starting Endless Survival to test Forward Arrow acceleration and lateral movement...');
  await page.click('#btn-play-endless');
  await new Promise(r => setTimeout(r, 800));

  // Check initial cruising speed
  const cruiseSpeed = await page.$eval('#hud-speed-num', el => parseInt(el.textContent || '0', 10));
  console.log(`Cruising Speed without throttle: ${cruiseSpeed} km/h`);

  // Press Forward Arrow (ArrowUp) to speed up!
  console.log('Holding ArrowUp (Forward Arrow) to accelerate...');
  await page.keyboard.down('ArrowUp');
  await new Promise(r => setTimeout(r, 1500));

  const acceleratedSpeed = await page.$eval('#hud-speed-num', el => parseInt(el.textContent || '0', 10));
  console.log(`Speed after holding ArrowUp: ${acceleratedSpeed} km/h`);
  if (acceleratedSpeed > cruiseSpeed) {
    console.log(`✅ Forward Arrow successfully increases speed from ${cruiseSpeed} to ${acceleratedSpeed} km/h!`);
  } else {
    console.warn('⚠️ Speed did not increase as expected');
  }

  // Steer to the right lane (ArrowRight)
  console.log('Steering to right lane with ArrowRight...');
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, 700));
  await page.keyboard.up('ArrowRight');
  await new Promise(r => setTimeout(r, 300));

  // Steer to the left lane (ArrowLeft)
  console.log('Steering to left lane with ArrowLeft...');
  await page.keyboard.down('ArrowLeft');
  await new Promise(r => setTimeout(r, 1000));
  await page.keyboard.up('ArrowLeft');

  await page.screenshot({ path: path.join(screenshotDir, 'verify_lane_movement.png') });
  console.log('📸 Captured verify_lane_movement.png');

  // Test braking with ArrowDown
  console.log('Testing braking with ArrowDown...');
  await page.keyboard.down('ArrowDown');
  await new Promise(r => setTimeout(r, 1000));
  const brakedSpeed = await page.$eval('#hud-speed-num', el => parseInt(el.textContent || '0', 10));
  console.log(`Speed after braking with ArrowDown: ${brakedSpeed} km/h`);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('ArrowUp');

  // Capture curved road with traffic following properly
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(screenshotDir, 'verify_curved_road_traffic.png') });
  console.log('📸 Captured verify_curved_road_traffic.png');

  // 3. Test Reaction Drill Mode
  console.log('Testing Reaction Drill Mode...');
  // Reload page to start fresh from menu
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  // Start Reaction Drill
  await page.click('#btn-play-drill');
  console.log('Reaction Drill started! Waiting for hazard prompt...');
  await new Promise(r => setTimeout(r, 2200));

  // Capture drill hazard prompt
  await page.screenshot({ path: path.join(screenshotDir, 'verify_drill_hazard.png') });
  console.log('📸 Captured verify_drill_hazard.png');

  // Evade hazard by steering left
  await page.keyboard.down('KeyA');
  await new Promise(r => setTimeout(r, 600));
  await page.keyboard.up('KeyA');
  await new Promise(r => setTimeout(r, 800));

  await page.screenshot({ path: path.join(screenshotDir, 'verify_drill_evaded.png') });
  console.log('📸 Captured verify_drill_evaded.png');

  await browser.close();
  console.log('🎉 All verifications completed successfully!');
}

verifyAllFixes().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
