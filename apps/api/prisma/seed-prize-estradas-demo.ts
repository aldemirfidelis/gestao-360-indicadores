/* eslint-disable no-console */
/**
 * DEMONSTRAÇÃO de apuração ponta a ponta do anexo 0561 (o que a outra IA não
 * conseguiu concluir). Roda os SERVIÇOS REAIS da plataforma (mesma lógica da
 * UI) via contexto Nest, sobre a estrutura criada por seed-prize-estradas.ts:
 *
 *  1. importa uma base elegível FICTÍCIA (3 "Coordenador de Área") na 2026-06,
 *     com eventos (falta, atestado) p/ exibir proporcionalidade e moderadores;
 *  2. lança o realizado coletivo dos 2 indicadores (22780=97 → faixa 40%,
 *     32131=16 → faixa 100% ⇒ ganho ponderado 70%);
 *  3. roda a apuração (motor v1.1.0) e imprime o resultado + memória de cálculo.
 *
 * Dados 100% fictícios (nenhum dado pessoal real). Idempotente: reimporta lote,
 * regrava realizado e versiona a apuração.
 *
 * Uso: npx tsx prisma/seed-prize-estradas-demo.ts   (env: SEED_ADMIN_EMAIL, SEED_COMPETENCE=2026-06)
 */
import { NestFactory } from '@nestjs/core';
// Importa do build compilado (dist/), que existe na imagem de produção.
import { AppModule } from '../dist/src/app.module';
import { PrismaService } from '../dist/src/prisma/prisma.service';
import { PrizeEligibleService } from '../dist/src/modules/prize/prize-eligible.service';
import { PrizeActualsService } from '../dist/src/modules/prize/prize-actuals.service';
import { PrizeCalcService } from '../dist/src/modules/prize/prize-calc.service';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'aldemir.fidelis@gmail.com';
const COMP_LABEL = process.env.SEED_COMPETENCE ?? '2026-06';
const money = (v: unknown) => `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'], abortOnError: false });
  try {
    const prisma = app.get(PrismaService);
    const eligible = app.get(PrizeEligibleService);
    const actuals = app.get(PrizeActualsService);
    const calc = app.get(PrizeCalcService);

    const user = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL, deletedAt: null } })
      ?? await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
    if (!user) throw new Error('Usuário administrador não encontrado.');
    const companyId = process.env.SEED_COMPANY_ID ?? user.companyId;
    const me = { sub: user.id, email: user.email, name: user.name, role: user.role, companyId } as any;
    console.log(`\nEmpresa: ${companyId} | Ator: ${user.email}\n`);

    const program = await prisma.prizeProgram.findFirst({ where: { companyId, code: 'PRM-ESTRADAS', deletedAt: null } });
    if (!program) throw new Error('Programa PRM-ESTRADAS não encontrado. Rode antes: make seed-prize-estradas');
    const competence = await prisma.prizeCompetence.findFirst({ where: { companyId, programId: program.id, label: COMP_LABEL } });
    if (!competence) throw new Error(`Competência ${COMP_LABEL} não encontrada.`);
    const inds = await prisma.prizeIndicator.findMany({ where: { companyId, programId: program.id, deletedAt: null } });
    const ind22780 = inds.find((i) => i.code === '22780')!;
    const ind32131 = inds.find((i) => i.code === '32131')!;

    // -------------------------------------------------------------------------
    // 1. Base elegível fictícia (Coordenador de Área) + eventos
    // -------------------------------------------------------------------------
    console.log(`== 1. Base elegível fictícia (${COMP_LABEL}) ==`);
    const rows = [
      { registration: '90001', name: 'João da Silva (DEMO)', cpf: '52998224725', positionRef: 'Coordenador de Área', areaRef: 'Goiasa - Estradas', costCenterRef: 'CC-ESTRADAS', baseSalary: 3000, admissionDate: '2020-01-10', situation: 'ACTIVE' },
      { registration: '90002', name: 'Maria Souza (DEMO)', cpf: '15350946056', positionRef: 'Coordenador de Área', areaRef: 'Goiasa - Estradas', costCenterRef: 'CC-ESTRADAS', baseSalary: 4000, admissionDate: '2019-03-01', situation: 'ACTIVE' },
      { registration: '90003', name: 'Carlos Lima (DEMO)', cpf: '01234567890', positionRef: 'Coordenador de Área', areaRef: 'Goiasa - Estradas', costCenterRef: 'CC-ESTRADAS', baseSalary: 2500, admissionDate: '2021-06-15', situation: 'ACTIVE' },
    ];
    const events = [
      { registration: '90002', type: 'FALTA', days: 1, date: `${COMP_LABEL}-10`, description: 'Falta injustificada (demo)' },
      { registration: '90003', type: 'ATESTADO', days: 2, date: `${COMP_LABEL}-05`, description: 'Atestado único — 1º abonado (demo)' },
    ];
    const imp = await eligible.import(me, competence.id, { source: 'MANUAL', rows, events });
    console.log(`  lote ${imp.job.lotVersion}: ${rows.length} colaboradores, ${events.length} evento(s)`);

    // -------------------------------------------------------------------------
    // 2. Realizado coletivo dos indicadores
    // -------------------------------------------------------------------------
    console.log('\n== 2. Realizado coletivo ==');
    await actuals.saveGrid(me, competence.id, [
      { indicatorId: ind22780.id, realized: 97 }, // faixa [96,01–97] → 40% pago
      { indicatorId: ind32131.id, realized: 16 }, // meta (zero 17,33 / meta 16) → 100% pago
    ]);
    console.log('  22780 = 97  (faixa 40%)   |   32131 = 16  (faixa 100%)   ⇒ ganho ponderado 70%');

    // -------------------------------------------------------------------------
    // 3. Apuração (motor real)
    // -------------------------------------------------------------------------
    console.log('\n== 3. Apuração ==');
    const run = await calc.run(me, competence.id, 'Demonstração do anexo 0561 (base fictícia)');
    console.log(`  run v${run.version} status=${run.status} colaboradores=${run.totalEmployees} total=${money(run.totalFinal)}`);

    const { results } = await calc.results(companyId, competence.id);
    console.log('\n  Colaborador            Salário     Potencial   Ganho   Bruto       Reduções   Final');
    for (const r of results) {
      console.log(
        `  ${r.name.padEnd(22)} ${money(r.baseSalary).padStart(10)} ${money(r.potential).padStart(10)} ` +
        `${String(r.weightedGain).padStart(5)}% ${money(r.grossValue).padStart(10)} ${money(r.totalReductions).padStart(10)} ${money(r.finalValue).padStart(10)}`,
      );
    }

    // Memória de cálculo do colaborador com moderador (90002)
    const maria = results.find((r) => r.registration === '90002');
    if (maria) {
      const mem = await calc.memory(companyId, maria.id);
      console.log(`\n  — Memória de cálculo: ${maria.name} —`);
      for (const l of mem.lines) {
        console.log(`    [${String(l.step).padStart(2)}] ${l.label}${l.value !== null ? ` = ${l.value}` : ''}${l.detail ? `  (${l.detail})` : ''}`);
      }
    }

    console.log('\n✓ Demonstração concluída. Veja em Gestão de Prêmio → Apuração Mensal (competência ' + COMP_LABEL + ').');
  } finally {
    await app.close();
  }
}

main().catch((e) => { console.error('\n✗ ERRO:', e); process.exit(1); });
