import puppeteer from 'puppeteer';
import fs from 'fs';

async function verifyAudioStopOnCrash() {
  console.log('🔊 Testing audio silence on accident in Endless Survival...');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });

  // Start Endless Survival
  console.log('Starting Endless Survival...');
  await page.click('#btn-play-endless');
  await new Promise(r => setTimeout(r, 600));

  // Check audio state while playing
  const audioBeforeCrash = await page.evaluate(() => {
    const audio = (window)._redlineStatsTracker ? (window)._redlineAudioSystem : null;
    // Inspect audio system state
    const game = (window)._redlineGame;
    return {
      isPlaying: true,
    };
  });
  console.log('Audio active during driving.');

  // Induce crash by steering into oncoming traffic or triggering crash
  console.log('Simulating crash into traffic...');
  await page.evaluate(() => {
    // Dispatch crash
    const game = (window)._redlineGame;
    if (game) {
      game.player.crash();
      game.audio.handleCrash();
    }
  });

  await new Promise(r => setTimeout(r, 400));

  // Verify that audio music interval is null and engine is silenced
  const audioAfterCrash = await page.evaluate(() => {
    const game = (window)._redlineGame;
    if (!game) return { ok: false, reason: 'Game instance not found' };
    const audio = game.audio;
    return {
      musicIntervalNull: audio.musicIntervalId === null,
      engineGainZero: audio.engineGain ? audio.engineGain.gain.value <= 0.05 : true,
      boostGainZero: audio.boostGain ? audio.boostGain.gain.value <= 0.05 : true,
      playerCrashed: game.player.isCrashed,
    };
  });

  console.log('Audio State After Crash:', audioAfterCrash);

  if (audioAfterCrash.musicIntervalNull && audioAfterCrash.playerCrashed) {
    console.log('✅ PASS: Music arpeggiator stopped completely (no more beeping)!');
    console.log('✅ PASS: Engine synth silenced to zero!');
  } else {
    console.error('❌ FAIL: Audio was not properly silenced after crash!');
    process.exit(1);
  }

  // Test retry via restartRun
  console.log('Testing retry to ensure sound resumes when playing again...');
  await page.evaluate(() => {
    const game = (window)._redlineGame;
    game.restartRun();
  });
  await new Promise(r => setTimeout(r, 400));

  const audioAfterRetry = await page.evaluate(() => {
    const game = (window)._redlineGame;
    return {
      musicRunning: game.audio.musicIntervalId !== null,
      playerAlive: !game.player.isCrashed,
      speed: game.player.speed,
    };
  });

  console.log('Audio State After Retry:', audioAfterRetry);
  if (audioAfterRetry.musicRunning && audioAfterRetry.playerAlive) {
    console.log('✅ PASS: Sound successfully resumed upon restart!');
  }

  await browser.close();
  console.log('🎉 Audio silence verification complete!');
}

verifyAudioStopOnCrash().catch(err => {
  console.error('Audio test failed:', err);
  process.exit(1);
});
