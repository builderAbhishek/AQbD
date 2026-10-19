const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.project.findFirst();
  const design = Object.values(p.data.designs)[0];
  const factors = design.config.factors;
  const runs = design.runs;
  const analyses = design.analyses || p.data.analysis || {};

  console.log('=== REGRESSION MODELS AUDIT ===');
  for (const resp of design.config.responses) {
    console.log(`\n--- RESPONSE: ${resp.name} (${resp.id}) ---`);
    const an = analyses[resp.id];
    if (!an || !an.fittedModel) {
      console.log('No fitted model in analyses!');
      continue;
    }
    const fm = an.fittedModel;
    console.log('Model Type:', fm.modelType);
    console.log('Coded Equation:', fm.codedEquation);
    console.log('Actual Equation:', fm.actualEquation);
    console.log('R2:', fm.R2, 'adjR2:', fm.adjR2, 'predR2:', fm.predR2);
    console.log('RMSE (Std Dev):', fm.rmse);
    console.log('PRESS:', fm.press);
    console.log('Adequate Precision:', fm.adequatePrecision);
    console.log('dfModel:', fm.dfModel, 'dfError:', fm.dfError, 'dfTotal:', fm.dfTotal);

    console.log('Terms & Coefficients:');
    fm.terms.forEach((t, i) => {
      console.log(`  ${t.name} (${t.type}): ${fm.coefficients[i]}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
