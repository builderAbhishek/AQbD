const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany();
  console.log('Projects count:', projects.length);
  for (const p of projects) {
    console.log('Project ID:', p.id, 'Name:', p.name);
    const designs = p.data?.designs || {};
    for (const dId of Object.keys(designs)) {
      const d = designs[dId];
      console.log('  Design:', dId, 'Type:', d.type, 'Runs:', d.runs?.length);
      console.log('  Factors:', d.config?.factors?.map(f => f.name));
      console.log('  Responses:', d.config?.responses?.map(r => r.name));
      console.log('  Opt Options:', d.optimization?.options);
      console.log('  Opt Criteria count:', Object.keys(d.optimization?.criteria || {}).length);
      console.log('  Opt Results count:', d.optimization?.results?.solutions?.length);
      console.log('  Opt Starting Points count:', d.optimization?.results?.startingPoints?.length);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
