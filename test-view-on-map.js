const { chromium } = require('playwright');

async function testViewOnMap() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  
  try {
    // Test 1: Map with dropPin=1 should NOT show InfoCard
    console.log('TEST 1: Map with dropPin=1 (View on Map flow)');
    await page.goto('http://localhost:3001/map?lat=43.5885&lon=-116.1945&name=Triumph%20Airport&dropPin=1', { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    
    // Wait for the map to initialize
    await page.waitForTimeout(3000);
    
    const url = page.url();
    console.log('  URL after load:', url.replace(/http:\/\/localhost:3001/, ''));
    
    // Check for InfoCard (AirportInfo or similar)
    const infoCardSelectors = [
      '[class*="airport"]', 
      '[class*="infoCard"]', 
      '[class*="InfoCard"]',
      'div[style*="zIndex"][style*="50"]',
      'div:has-text("Triumph Airport")'
    ];
    
    let foundInfo = null;
    for (const sel of infoCardSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const text = await el.innerText().catch(() => '');
          if (text.includes('Triumph') || text.includes('Airport') || text.includes('Runway')) {
            foundInfo = { sel, text: text.slice(0, 100) };
            break;
          }
        }
      } catch {}
    }
    
    if (foundInfo) {
      console.log('  ✗ InfoCard FOUND (should NOT be present for dropPin=1):', foundInfo.text);
    } else {
      console.log('  ✓ No InfoCard found (correct for dropPin=1)');
    }
    
    // Check for map canvas
    const canvas = await page.$('canvas');
    console.log('  Map canvas present:', canvas !== null ? '✓' : '✗');
    
    // Check console for errors
    const errors = consoleLogs.filter(l => l.startsWith('[error]'));
    if (errors.length > 0) {
      console.log('  Console errors:', errors.slice(0, 3));
    }
    
    // Test 2: Map with directTo=1 should show InfoCard AND DirectTo panel
    console.log('\nTEST 2: Map with directTo=1 (Direct To flow)');
    await page.goto('http://localhost:3001/map?lat=43.5885&lon=-116.1945&name=Triumph%20Airport&directTo=1', { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    await page.waitForTimeout(3000);
    
    const url2 = page.url();
    console.log('  URL:', url2.replace(/http:\/\/localhost:3001/, ''));
    
    // Check for DirectTo panel
    const directToPanel = await page.$('text=Direct To');
    console.log('  Direct To panel:', directToPanel !== null ? '✓ found' : '✗ not found');
    
    // Check for InfoCard
    let foundInfo2 = null;
    for (const sel of infoCardSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const text = await el.innerText().catch(() => '');
          if (text.includes('Triumph') || text.includes('Airport') || text.includes('Runway')) {
            foundInfo2 = { sel, text: text.slice(0, 100) };
            break;
          }
        }
      } catch {}
    }
    console.log('  InfoCard:', foundInfo2 !== null ? 'found' : 'not found');
    
    console.log('\nDone.');
    
  } catch (e) {
    console.error('Test error:', e.message);
  } finally {
    await browser.close();
  }
}

testViewOnMap();
