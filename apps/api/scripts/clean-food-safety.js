const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log(" Iniciando Limpeza das Tabelas de Segurança de Alimentos");
  console.log("==================================================");

  // Ordem correta para evitar violação de restrições de chaves estrangeiras
  const tables = [
    'foodSafetyTraceLink',
    'foodSafetyRecallItem',
    'foodSafetyRecall',
    'foodSafetyLot',
    'foodSafetyMaterial',
    'foodSafetySupplier',
    'foodSafetyMonitoringRecord',
    'foodSafetyControlPlan',
    'foodSafetyHazard',
    'foodSafetyRiskMatrix',
    'foodSafetyRequirementAssessment',
    'foodSafetyRequirement',
    'foodSafetyStandardVersion',
    'foodSafetyStandard',
    'foodSafetyProcessStep',
    'foodSafetyProcess',
    'foodSafetyProgram'
  ];

  for (const table of tables) {
    if (prisma[table]) {
      try {
        const result = await prisma[table].deleteMany({});
        console.log(`[SUCESSO] Tabela '${table}': ${result.count} registros deletados.`);
      } catch (err) {
        console.error(`[ERRO] Falha ao deletar dados da tabela '${table}':`, err.message);
      }
    } else {
      console.warn(`[AVISO] Tabela '${table}' não foi encontrada no Prisma Client.`);
    }
  }

  console.log("==================================================");
  console.log(" Limpeza concluída!");
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("Erro fatal durante a limpeza:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
