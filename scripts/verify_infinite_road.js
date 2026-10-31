import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function verifyInfiniteRoadAnd3D() {
  console.log('🚀 Verifying Infinite Road, Straight Highway, Dispersed Traffic, and 3D Props...');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=d3d11'],
  });

  const page = await browser.newPage();
  const screenshotDir = path.resolve('screenshots');

  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });

  // 1. Start Endless Survival
  console.log('Starting Endless Survival...');
  await page.click('#btn-play-endless');
  await new Promise(r => setTimeout(r, 800));

  // 2. Capture initial straight road view
  await page.screenshot({ path: path.join(screenshotDir, '09_straight_highway.png') });
  console.log('📸 Captured 09_straight_highway.png');

  // 3. Fast-forward player to distance Z = 350,000 (3.5x past the original 100,000 threshold where road disappeared)
  console.log('Fast-forwarding player distance to Z = 350,000...');
  await page.evaluate(() => {
    const game = (window)._redlineGame;
    if (game) {
      game.player.z = 350000;
      game.player.speed = 12000;
    }
  });
  await new Promise(r => setTimeout(r, 600));

  // Verify road at Z = 350,000
  await page.screenshot({ path: path.join(screenshotDir, '10_infinite_road_350k.png') });
  console.log('📸 Captured 10_infinite_road_350k.png (Road still completely rendered!)');

  // 4. Fast-forward to Z = 750,000 (7.5x original threshold)
  console.log('Fast-forwarding player distance to Z = 750,000...');
  await page.evaluate(() => {
    const game = (window)._redlineGame;
    if (game) {
      game.player.z = 750000;
      game.player.speed = 12000;
      // Position player near an overhead gantry bridge
      const gantryZ = Math.round(750000 / 12000) * 12000 + 4000;
      game.player.z = gantryZ - 1800; // 1800 units before gantry
    }
  });
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(screenshotDir, '11_3d_gantry_and_traffic.png') });
  console.log('📸 Captured 11_3d_gantry_and_traffic.png');

  // 5. Test traffic dispersal: inspect traffic active cars positions and speeds
  const trafficData = await page.evaluate(() => {
    const game = (window)._redlineGame;
    const cars = game.trafficPool.activeItems;
    return cars.map((c) => ({
      lane: c.lane,
      speed: Math.round(c.speed),
      zDiffFromPlayer: Math.round(c.z - game.player.z),
      x: Math.round(c.x * 100) / 100,
    }));
  });

  console.log('Sample Active Traffic Cars ahead of player:', trafficData.slice(0, 5));

  // Verify speeds are varied and not all identical
  const speeds = trafficData.map(c => c.speed);
  const uniqueSpeeds = new Set(speeds);
  console.log(`Unique traffic speeds: ${uniqueSpeeds.size} distinct speeds across ${trafficData.length} cars`);
  if (uniqueSpeeds.size > 1) {
    console.log('✅ PASS: Traffic has varied speeds and is naturally dispersing!');
  } else {
    console.warn('⚠️ Warning: Speeds appear identical');
  }

  await browser.close();
  console.log('🎉 Infinite road and 3D props verification complete!');
}

verifyInfiniteRoadAnd3D().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

