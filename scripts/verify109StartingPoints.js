const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.project.findFirst();
  const design = Object.values(p.data.designs)[0];
  const factors = design.config.factors;
  const runs = design.runs;
  const opt = design.optimization;
  const criteria = opt.criteria;

  console.log('=== STAGE 1: CANDIDATES ===');
  console.log('Design Runs count:', runs.length);
  // Center point
  const centerPoint = {};
  factors.forEach(f => {
    centerPoint[f.id] = (f.low + f.high) / 2;
  });
  console.log('Center point candidate:', centerPoint);

  // Check each design run against factor criteria bounds
  console.log('\n=== STAGE 2: CHECKING DESIGN RUNS AGAINST FACTOR BOUNDS ===');
  const validDesignPoints = [];
  const rejectedDesignPoints = [];

  runs.forEach((r, idx) => {
    let isOutOfBounds = false;
    let reason = '';
    for (const f of factors) {
      const val = r.actualValues[f.id];
      const crit = criteria[f.id];
      const low = crit ? crit.lowerLimit : f.low;
      const high = crit ? crit.upperLimit : f.high;
      if (val < low - 1e-4) {
        isOutOfBounds = true;
        reason = `${f.name} = ${val} < lower limit ${low}`;
        break;
      }
      if (val > high + 1e-4) {
        isOutOfBounds = true;
        reason = `${f.name} = ${val} > upper limit ${high}`;
        break;
      }
    }
    if (isOutOfBounds) {
      rejectedDesignPoints.push({ runOrder: r.runOrder, stdOrder: r.stdOrder, reason, values: r.actualValues });
    } else {
      validDesignPoints.push({ runOrder: r.runOrder, stdOrder: r.stdOrder, values: r.actualValues });
    }
  });

  console.log('Valid design runs within factor criteria bounds:', validDesignPoints.length);
  console.log('Rejected out-of-bounds design runs:', rejectedDesignPoints.length);
  rejectedDesignPoints.forEach(rej => {
    console.log(`  Std ${rej.stdOrder} (Run ${rej.runOrder}): ${rej.reason}`);
  });

  console.log('\n=== STAGE 3: DEDUPLICATION OF VALID DESIGN POINTS ===');
  const uniqueValidPoints = [];
  const duplicatePoints = [];
  const seenKeys = new Set();

  // Add center point first
  const centerKey = factors.map(f => centerPoint[f.id].toFixed(4)).join(',');
  seenKeys.add(centerKey);
  uniqueValidPoints.push({ source: 'Center Point', factors: centerPoint });

  for (const pt of validDesignPoints) {
    const k = factors.map(f => pt.values[f.id].toFixed(4)).join(',');
    if (seenKeys.has(k)) {
      duplicatePoints.push({ source: `Std ${pt.stdOrder} (Run ${pt.runOrder})`, factors: pt.values, key: k });
    } else {
      seenKeys.add(k);
      uniqueValidPoints.push({ source: `Std ${pt.stdOrder} (Run ${pt.runOrder})`, factors: pt.values });
    }
  }

  console.log('Unique valid design points (including center):', uniqueValidPoints.length);
  console.log('Duplicate design points removed:', duplicatePoints.length);
  duplicatePoints.forEach(dup => {
    console.log(`  Duplicate: ${dup.source} at [${dup.key}]`);
  });

  console.log('\n=== STAGE 4: RANDOM STARTING POINTS ===');
  console.log('Requested random starting points: 100');
  console.log('Total accepted starting points passed to optimizer:');
  console.log(`${uniqueValidPoints.length} (unique valid design points) + 100 (random points) = ${uniqueValidPoints.length + 100}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
