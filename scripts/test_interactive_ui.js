const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\kkuma\\.gemini\\antigravity\\brain\\df6a44c5-226e-498b-a3bb-829c28e17e57\\screenshots';
const BASE_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getProjectId() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/v1/projects', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          resolve(list[0]?.id);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runInteractiveTests() {
  console.log('=== STARTING INTERACTIVE UI & MODEL BEHAVIOR TESTS ===');
  const projectId = await getProjectId();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      console.log('  [Browser Console Error]:', text);
    }
  });

  page.on('requestfailed', request => {
    networkErrors.push({ url: request.url(), failure: request.failure()?.errorText });
    console.log('  [Network Request Failed]:', request.url(), request.failure()?.errorText);
  });

  try {
    const targetUrl = `${BASE_URL}/?id=${projectId}`;
    console.log(`\n--- 1. Navigating to ${targetUrl} ---`);
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2000);

    // -------------------------------------------------------------
    // TEST A: SWITCHING SOLUTIONS IN NUMERICAL OPTIMIZATION
    // -------------------------------------------------------------
    console.log('\n--- TEST A: Selecting Solution #2 in Solutions Table ---');
    // Navigate to Solutions
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('span'));
      const solNode = nodes.find(n => n.innerText.trim() === 'Solutions');
      if (solNode) solNode.click();
    });
    await sleep(2000);

    // Click Solution #2 row or radio button
    const selectedSolBefore = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      // Click row 2
      if (rows.length >= 2) {
        rows[1].click();
      }
      return {
        row1Text: rows[0]?.innerText.trim().replace(/\n/g, ' '),
        row2Text: rows[1]?.innerText.trim().replace(/\n/g, ' ')
      };
    });
    await sleep(1500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '21_solution_2_selected_table.png') });
    console.log('Captured 21_solution_2_selected_table.png');

    // Check Ramps for Solution #2
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rampsBtn = btns.find(b => b.innerText.includes('Ramps'));
      if (rampsBtn) rampsBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '22_solution_2_ramps.png') });
    console.log('Captured 22_solution_2_ramps.png');

    // Switch back to Solution #1
    console.log('Switching back to Solution #1...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tablesBtn = btns.find(b => b.innerText.includes('Tables'));
      if (tablesBtn) tablesBtn.click();
    });
    await sleep(1000);
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      if (rows.length >= 1) rows[0].click();
    });
    await sleep(1000);

    // -------------------------------------------------------------
    // TEST B: GRAPHICAL OPTIMIZATION WORKSPACE
    // -------------------------------------------------------------
    console.log('\n--- TEST B: Graphical Optimization Workspace ---');
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('span'));
      const gNode = nodes.find(n => n.innerText.trim() === 'Graphical');
      if (gNode) gNode.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '23_graphical_optimization_workspace.png') });
    console.log('Captured 23_graphical_optimization_workspace.png');

    // -------------------------------------------------------------
    // TEST C: STALE OPTIMIZATION DETECTION ON CRITERIA CHANGE
    // -------------------------------------------------------------
    console.log('\n--- TEST C: Modifying Optimization Criteria & Stale Detection ---');
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('span'));
      const cNode = nodes.find(n => n.innerText.trim() === 'Criteria');
      if (cNode) cNode.click();
    });
    await sleep(2000);

    // Select Resolution response criterion in criteria master list
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div, button'));
      const resItem = items.find(el => el.innerText && el.innerText.includes('Resolution') && el.innerText.includes('Maximize'));
      if (resItem) resItem.click();
    });
    await sleep(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '24_criteria_resolution_selected.png') });
    console.log('Captured 24_criteria_resolution_selected.png');

    // Change Resolution lower weight slider or importance
    console.log('Changing Resolution importance to 4 (++++)...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const sel of selects) {
        if (sel.value === '3' || Array.from(sel.options).some(o => o.text.includes('Default') || o.text.includes('+++'))) {
          // Select 4
          for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === '4' || sel.options[i].text.includes('4')) {
              sel.selectedIndex = i;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
      }
    });
    await sleep(1500);

    // Switch to Solutions view and check if marked STALE or results recalculated
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const solTab = btns.find(b => b.innerText.trim() === 'Solutions');
      if (solTab) solTab.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '25_solutions_after_criteria_change.png') });
    console.log('Captured 25_solutions_after_criteria_change.png');

    // Revert importance back to 3
    console.log('Reverting Resolution importance back to 3...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const critTab = btns.find(b => b.innerText.trim() === 'Criteria');
      if (critTab) critTab.click();
    });
    await sleep(1500);
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const sel of selects) {
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === '3' || sel.options[i].text.includes('3')) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    });
    await sleep(1500);

    // Run Optimization again to normalize
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const solTab = btns.find(b => b.innerText.trim() === 'Solutions');
      if (solTab) solTab.click();
    });
    await sleep(1500);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const runBtn = btns.find(b => b.innerText.includes('Run Optimization'));
      if (runBtn) runBtn.click();
    });
    await sleep(4000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '26_solutions_renormalized.png') });
    console.log('Captured 26_solutions_renormalized.png');

    // -------------------------------------------------------------
    // TEST D: PAGE REFRESH & PERSISTENCE VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- TEST D: Page Refresh & Persistence ---');
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '27_persisted_after_refresh.png') });
    console.log('Captured 27_persisted_after_refresh.png');

    console.log('\n=== ALL INTERACTIVE TESTS COMPLETED SUCCESSFULLY ===');

  } catch (err) {
    console.error('Interactive test error:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interactive_error.png') });
  } finally {
    await browser.close();
  }
}

runInteractiveTests();
