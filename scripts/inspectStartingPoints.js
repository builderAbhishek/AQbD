const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.project.findFirst();
  const design = Object.values(p.data.designs)[0];
  const factors = design.config.factors;
  const runs = design.runs;
  const opt = design.optimization;

  console.log('--- FACTORS ---');
  factors.forEach(f => console.log(f.id, f.name, f.low, f.high));

  console.log('--- CRITERIA ---');
  console.log(JSON.stringify(opt.criteria, null, 2));

  console.log('--- STARTING POINTS COUNT ---', opt.results?.startingPoints?.length);
  const sps = opt.results?.startingPoints || [];
  
  // Check duplicates in starting points
  const keys = new Set();
  const dupes = [];
  sps.forEach((sp, idx) => {
    const k = factors.map(f => sp.factors[f.id]?.toFixed(4)).join(',');
    if (keys.has(k)) {
      dupes.push({ idx: idx + 1, pointNumber: sp.pointNumber, k });
    } else {
      keys.add(k);
    }
  });

  console.log('Unique factor coordinates among 121 starting points:', keys.size);
  console.log('Duplicate starting points count:', dupes.length);
  console.log('Duplicate starting points details:', dupes);

  // Check design points
  console.log('--- DESIGN RUNS ---');
  const runKeys = new Set();
  const runDupes = [];
  runs.forEach((r, idx) => {
    const k = factors.map(f => r.actualValues[f.id]?.toFixed(4)).join(',');
    if (runKeys.has(k)) {
      runDupes.push({ idx: idx + 1, std: r.stdOrder, run: r.runOrder, k });
    } else {
      runKeys.add(k);
    }
  });
  console.log('Total design runs:', runs.length);
  console.log('Unique design runs coordinates:', runKeys.size);
  console.log('Duplicate design runs:', runDupes.length, runDupes);
}

main().catch(console.error).finally(() => prisma.$disconnect());
