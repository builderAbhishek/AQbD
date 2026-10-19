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

async function runQA() {
  console.log('=== STARTING COMPLETE AQBD STUDIO V1.0 E2E MANUAL QA ===');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const projectId = await getProjectId();
  console.log('Target Project ID:', projectId);

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
    // -------------------------------------------------------------
    // 1. OPEN PROJECT DIRECTLY & INSPECT DESIGN TABLE
    // -------------------------------------------------------------
    const targetUrl = `${BASE_URL}/?id=${projectId}`;
    console.log(`\n--- 1. Navigating to ${targetUrl} ---`);
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_design_table.png') });
    console.log('Captured 01_design_table.png');

    // -------------------------------------------------------------
    // 2. POINT PREDICTION AT CENTER POINT (A=40, B=3.0, C=30)
    // -------------------------------------------------------------
    console.log('\n--- 2. Point Prediction Workspace ---');
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('span'));
      const ppNode = nodes.find(n => n.innerText.trim() === 'Point Prediction');
      if (ppNode) ppNode.click();
    });
    await sleep(2000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_point_prediction_center.png') });
    console.log('Captured 02_point_prediction_center.png');

    const extractPointPredTable = async () => {
      return await page.evaluate(() => {
        const tables = Array.from(document.querySelectorAll('table'));
        return tables.map(t => {
          const rows = Array.from(t.querySelectorAll('tr'));
          return rows.map(r => Array.from(r.querySelectorAll('th, td')).map(c => c.innerText.trim().replace(/\n/g, ' ')));
        });
      });
    };

    const ppCenter = await extractPointPredTable();
    console.log('Point Prediction at Center Point:');
    console.log(JSON.stringify(ppCenter[2], null, 2));

    // -------------------------------------------------------------
    // 3. CHANGE FACTOR A FROM 40 TO 42 USING KEYBOARD
    // -------------------------------------------------------------
    console.log('\n--- 3. Modifying Factor A to 42 in Point Prediction ---');
    // Click on Factor A level input in Factors table
    const factorInputs = await page.$$('table input[type="number"]');
    if (factorInputs.length > 0) {
      await factorInputs[0].click();
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('42');
      await page.keyboard.press('Enter');
      await sleep(1500);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_point_prediction_modified_A42.png') });
      console.log('Captured 03_point_prediction_modified_A42.png');

      const ppA42 = await extractPointPredTable();
      console.log('Point Prediction at A=42:');
      console.log(JSON.stringify(ppA42[2], null, 2));

      // Restore Factor A back to 40
      console.log('Restoring Factor A back to 40...');
      await factorInputs[0].click();
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('40');
      await page.keyboard.press('Enter');
      await sleep(1500);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_point_prediction_restored_A40.png') });
      console.log('Captured 04_point_prediction_restored_A40.png');
    }

    // -------------------------------------------------------------
    // 4. NUMERICAL OPTIMIZATION: CRITERIA SCREEN & OPTIONS MODAL
    // -------------------------------------------------------------
    console.log('\n--- 4. Numerical Optimization - Criteria ---');
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('span'));
      const critNode = nodes.find(n => n.innerText.trim() === 'Criteria');
      if (critNode) critNode.click();
    });
    await sleep(2000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_optimization_criteria.png') });
    console.log('Captured 05_optimization_criteria.png');

    // Open Options Modal
    console.log('\n--- 5. Optimization Options Modal ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const optBtn = btns.find(b => b.innerText.includes('Options'));
      if (optBtn) optBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_optimization_options_modal.png') });
    console.log('Captured 06_optimization_options_modal.png');

    // Close Options Modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cancelBtn = btns.find(b => b.innerText.includes('Cancel') || b.innerText.includes('Close'));
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(1000);

    // -------------------------------------------------------------
    // 5. NAVIGATE TO SOLUTIONS SCREEN & RUN OPTIMIZATION
    // -------------------------------------------------------------
    console.log('\n--- 6. Switching to Solutions Screen ---');
    await page.evaluate(() => {
      // Click 'Solutions' in Project Tree or sub-tab bar
      const btns = Array.from(document.querySelectorAll('button'));
      const solTab = btns.find(b => b.innerText.trim() === 'Solutions');
      if (solTab) {
        solTab.click();
      } else {
        const nodes = Array.from(document.querySelectorAll('span'));
        const solNode = nodes.find(n => n.innerText.trim() === 'Solutions');
        if (solNode) solNode.click();
      }
    });
    await sleep(2000);

    // Click "Run Optimization" button
    console.log('Clicking "Run Optimization" button in UI...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const runBtn = btns.find(b => b.innerText.includes('Run Optimization') || b.innerText.includes('Optimize'));
      if (runBtn) runBtn.click();
    });
    console.log('Waiting for optimizer execution to complete...');
    await sleep(5000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_solutions_table.png') });
    console.log('Captured 07_solutions_table.png');

    const solutionsData = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      return tables.map(t => {
        const rows = Array.from(t.querySelectorAll('tr'));
        return rows.map(r => Array.from(r.querySelectorAll('th, td')).map(c => c.innerText.trim().replace(/\n/g, ' ')));
      });
    });
    console.log('Solutions Table Extracted (Top 5):');
    if (solutionsData.length > 0) {
      console.log(JSON.stringify(solutionsData[0].slice(0, 6), null, 2));
    }

    // -------------------------------------------------------------
    // 6. STARTING POINTS TABLE
    // -------------------------------------------------------------
    console.log('\n--- 7. Starting Points Subtab ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const spBtn = btns.find(b => b.innerText.includes('Starting Points'));
      if (spBtn) spBtn.click();
    });
    await sleep(1500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_starting_points_table.png') });
    console.log('Captured 08_starting_points_table.png');

    const spData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return {
        totalRows: rows.length,
        firstThree: rows.slice(0, 3).map(r => Array.from(r.querySelectorAll('td')).map(c => c.innerText.trim()))
      };
    });
    console.log('Starting Points count in UI:', spData.totalRows);
    console.log('Starting Points sample:', JSON.stringify(spData.firstThree, null, 2));

    // -------------------------------------------------------------
    // 7. SOLUTIONS VISUALIZATIONS: RAMPS VIEW
    // -------------------------------------------------------------
    console.log('\n--- 8. Solutions Visualizations: Ramps View ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rampsBtn = btns.find(b => b.innerText.includes('Ramps'));
      if (rampsBtn) rampsBtn.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_ramps_view.png') });
    console.log('Captured 09_ramps_view.png');

    // -------------------------------------------------------------
    // 8. SOLUTIONS VISUALIZATIONS: BAR GRAPH VIEW
    // -------------------------------------------------------------
    console.log('\n--- 9. Solutions Visualizations: Bar Graph View ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const bgBtn = btns.find(b => b.innerText.includes('Bar Graph'));
      if (bgBtn) bgBtn.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_bargraph_view.png') });
    console.log('Captured 10_bargraph_view.png');

    // -------------------------------------------------------------
    // 9. SOLUTIONS VISUALIZATIONS: REPORT VIEW
    // -------------------------------------------------------------
    console.log('\n--- 10. Solutions Visualizations: Report View ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const repBtn = btns.find(b => b.innerText.includes('Report'));
      if (repBtn) repBtn.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_report_view.png') });
    console.log('Captured 11_report_view.png');

    // -------------------------------------------------------------
    // 10. SOLUTIONS VISUALIZATIONS: OPTIMIZATION GRAPHS
    // -------------------------------------------------------------
    console.log('\n--- 11. Solutions Visualizations: Graphs Tab ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const gBtn = btns.find(b => b.innerText.trim() === 'Graphs' && b.getAttribute('title')?.includes('Response and desirability'));
      if (gBtn) {
        gBtn.click();
      } else {
        const gBtn2 = btns.find(b => b.innerText.includes('Graphs'));
        if (gBtn2) gBtn2.click();
      }
    });
    await sleep(2500);

    // Perturbation
    console.log('Capturing Perturbation Graph...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.innerText.includes('Perturbation'));
      if (b) b.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_graphs_perturbation.png') });
    console.log('Captured 12_graphs_perturbation.png');

    // One Factor
    console.log('Capturing One Factor Graph...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.innerText.includes('One Factor'));
      if (b) b.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_graphs_one_factor.png') });
    console.log('Captured 13_graphs_one_factor.png');

    // All Factors
    console.log('Capturing All Factors Graph...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.innerText.includes('All Factors'));
      if (b) b.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_graphs_all_factors.png') });
    console.log('Captured 14_graphs_all_factors.png');

    // Interaction
    console.log('Capturing Interaction Graph...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.innerText.includes('Interaction'));
      if (b) b.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_graphs_interaction.png') });
    console.log('Captured 15_graphs_interaction.png');

    // Contour
    console.log('Capturing Contour Graph...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.innerText.includes('Contour'));
      if (b) b.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_graphs_contour.png') });
    console.log('Captured 16_graphs_contour.png');

    // 3D Surface
    console.log('Capturing 3D Surface Graph...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.innerText.includes('3D Surface') || x.innerText.includes('Surface'));
      if (b) b.click();
    });
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_graphs_3d_surface.png') });
    console.log('Captured 17_graphs_3d_surface.png');

    // -------------------------------------------------------------
    // 11. RESPONSE ANALYSIS WORKSPACES (ANOVA & COEFFICIENTS)
    // -------------------------------------------------------------
    console.log('\n--- 12. Response Analysis Workspaces ---');
    // Resolution
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('span'));
      const n = nodes.find(x => x.innerText.includes('Resolution (Analyzed)'));
      if (n) n.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18_analysis_resolution.png') });
    console.log('Captured 18_analysis_resolution.png');

    // Retention Time
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('span'));
      const n = nodes.find(x => x.innerText.includes('Retention Time (Analyzed)'));
      if (n) n.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19_analysis_retention_time.png') });
    console.log('Captured 19_analysis_retention_time.png');

    // Tailing Factor
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('span'));
      const n = nodes.find(x => x.innerText.includes('Tailing Factor (Analyzed)'));
      if (n) n.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20_analysis_tailing_factor.png') });
    console.log('Captured 20_analysis_tailing_factor.png');

    // Save final report data summary
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'qa_full_run_results.json'),
      JSON.stringify({
        consoleLogs,
        networkErrors,
        ppCenter,
        solutionsData,
        spData
      }, null, 2)
    );

    console.log('\n=== COMPREHENSIVE QA EXECUTION FINISHED SUCCESSFULLY ===');

  } catch (err) {
    console.error('QA Runner encountered error:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'qa_error.png') });
  } finally {
    await browser.close();
  }
}

runQA();
