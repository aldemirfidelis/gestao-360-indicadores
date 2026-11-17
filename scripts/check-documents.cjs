'use strict';
// Ensaio de integração do GED: somente Postgres descartável, nunca a base do produto.
// Executar com os serviços compilados (./dist) apontando para o banco descartável.
const path = require('node:path');
const { createRequire } = require('node:module');
const apiRoot = path.resolve(__dirname, '../apps/api');
const fromApi = createRequire(path.join(apiRoot, 'package.json'));
const service = (file) => require(path.join(apiRoot, 'dist/src', file));
fromApi('reflect-metadata');
const assert = require('node:assert/strict');
const bcrypt = fromApi('bcryptjs');
const { PrismaClient } = fromApi('@prisma/client');
const { PDFDocument } = fromApi('pdf-lib');
const { markdownToDoc, docToPlainText } = fromApi('@g360/shared');
const { AccessService } = service('modules/access/access.service');
const { TraceabilityService } = service('modules/traceability/traceability.service');
const { PERMISSION_CATALOG } = service('modules/users/permission-catalog');
const { DocumentAccessService } = service('modules/documents/document-access.service');
const { DocumentStorageService } = service('modules/documents/document-storage.service');
const { DocumentEditorService } = service('modules/documents/document-editor.service');
const { DocumentRenderService } = service('modules/documents/document-render.service');
const { DocumentContentService } = service('modules/documents/document-content.service');
const { DocumentCodeService } = service('modules/documents/document-code.service');
const { DocumentWorkflowService } = service('modules/documents/document-workflow.service');
const { DocumentDistributionService } = service('modules/documents/document-distribution.service');
const { DocumentChangeRequestService } = service('modules/documents/document-change-request.service');
const { DocumentGovernanceService } = service('modules/documents/document-governance.service');
const { DocumentAiService } = service('modules/documents/document-ai.service');
const { DocumentsService } = service('modules/documents/documents.service');
const { isDocxBuffer } = service('modules/documents/docx.util');

const db = new PrismaClient();
const pass = (message) => console.log('PASS:', message);
const PASSWORD = 'Assinatura#2026';

async function rejects(promise, pattern, label) {
  await assert.rejects(promise, (error) => pattern.test(String(error?.message ?? error)), label);
}

async function run() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.pathname, '/g360_documents_review');
  assert.equal(process.env.DOCUMENTS_REVIEW_ISOLATED, '1');
  delete process.env.DOCUMENT_STORAGE_PROVIDER; // padrão: arquivos no Postgres

  const company = await db.company.create({ data: { name: 'Ensaio isolado do GED', areaAccessEnabled: false } });
  const foreign = await db.company.create({ data: { name: 'Sentinela de isolamento do GED' } });
  const area = await db.orgNode.create({ data: { companyId: company.id, name: 'Produção', type: 'AREA' } });
  const sector = await db.orgNode.create({ data: { companyId: company.id, name: 'Linha 1', type: 'SECTOR', parentId: area.id } });
  const hash = bcrypt.hashSync(PASSWORD, 4);
  // E-mails únicos por execução: o ensaio pode ser repetido no mesmo banco descartável.
  const runId = Date.now().toString(36);
  const user = (companyId, name, email, role, nodeId) =>
    db.user.create({ data: { companyId, name, email: email.replace('@', `+${runId}@`), passwordHash: hash, role, defaultNodeId: nodeId ?? null } });
  const author = await user(company.id, 'Elaboradora', 'ged-author@example.test', 'ANALYST', area.id);
  const reviewer = await user(company.id, 'Revisor técnico', 'ged-reviewer@example.test', 'ANALYST', null);
  const approver = await user(company.id, 'Aprovadora', 'ged-approver@example.test', 'ANALYST', null);
  const reader = await user(company.id, 'Operador da linha', 'ged-reader@example.test', 'VIEWER', sector.id);
  const manager = await user(company.id, 'Gestora do GED', 'ged-manager@example.test', 'ANALYST', null);
  const outsider = await user(foreign.id, 'Pessoa de fora', 'ged-outsider@example.test', 'ANALYST', null);
  for (const [key, description, module, action] of PERMISSION_CATALOG) {
    await db.permission.upsert({ where: { key }, create: { key, description, module, action }, update: {} });
  }
  const grants = [
    [author.id, ['doc:view', 'doc:create', 'doc:update']],
    [reviewer.id, ['doc:view']],
    [approver.id, ['doc:view']],
    [reader.id, ['doc:view']],
    [manager.id, ['doc:view', 'doc:manage']],
    [outsider.id, ['doc:view', 'doc:create', 'doc:update']],
  ];
  for (const [userId, keys] of grants) for (const key of keys) {
    const permission = await db.permission.findUniqueOrThrow({ where: { key } });
    await db.userPermission.create({ data: { userId, permissionId: permission.id } });
  }
  const payload = (record) => ({ sub: record.id, companyId: record.companyId, name: record.name, email: record.email, role: record.role });
  const me = payload(author), rev = payload(reviewer), apr = payload(approver), rea = payload(reader), mgr = payload(manager), out = payload(outsider);

  const sent = [];
  const notifications = { create: async (companyId, userId, kind, title, body, link) => { sent.push({ userId, kind, title, link }); return { id: String(sent.length) }; } };
  const workItems = { markDirty: () => {} };
  const access = new AccessService(db, { write: async () => {}, record: async () => {} });
  const trace = new TraceabilityService(db, null);
  const accessPolicy = new DocumentAccessService(db, access);
  const storage = new DocumentStorageService(db);
  const editor = new DocumentEditorService();
  const render = new DocumentRenderService(db, storage, editor);
  const content = new DocumentContentService(db, accessPolicy, render);
  const codes = new DocumentCodeService(db);
  const workflow = new DocumentWorkflowService(db, accessPolicy, notifications, workItems, content, render);
  const distribution = new DocumentDistributionService(db, access, notifications, workItems);
  const changeRequests = new DocumentChangeRequestService(db, accessPolicy, notifications, workItems);
  const governance = new DocumentGovernanceService(db, accessPolicy, storage, workflow, distribution, changeRequests);
  const ai = new DocumentAiService(db, { generateText: async () => null });
  const documents = new DocumentsService(db, trace, access, codes, editor, storage, workItems, notifications, accessPolicy, content, render, workflow, distribution, changeRequests, governance, ai);

  // 1. Tipos padrão incluem POP e Norma; criação no editor visual com participantes e público.
  await codes.ensureDefaultTypes(company.id, author.id);
  const types = await db.documentTypeConfig.findMany({ where: { companyId: company.id } });
  const pop = types.find((type) => type.sigla === 'POP');
  assert.ok(pop && types.some((type) => type.sigla === 'NOR'));
  const body = [
    '# 1. Objetivo', 'Garantir a higienização das mãos antes de entrar na linha de produção.',
    '# 2. Aplicação', 'Todos os operadores da produção.',
    '# 3. Responsabilidades', '| Função | Responsabilidade |', '|---|---|', '| Operador | Executa a higienização |',
    '# 4. Descrição das atividades', '1. Molhar as mãos', '2. Esfregar com sabão por 40 segundos',
    '# 5. Registros', '- Formulário de higienização (FOR-010)',
  ].join('\n');
  const created = await documents.create(me, {
    title: 'Higienização das mãos',
    typeConfigId: pop.id,
    orgNodeId: area.id,
    contentJson: markdownToDoc(body),
    reviewerIds: [reviewer.id],
    approverIds: [approver.id],
    distribution: { readRequired: true, readDueDays: 3, orgNodeIds: [area.id] },
  });
  assert.equal(created.code, 'POP-001');
  assert.equal(created.contentFormat, 'STRUCTURED');
  assert.equal(created.typeConfigId, pop.id);
  assert.equal(created.workflow.reviewers[0].id, reviewer.id);
  await rejects(documents.create(me, { title: 'Autoaprovação', approverIds: [author.id] }), /não pode revisá-lo nem aprová-lo/, 'elaborador não aprova');
  pass('POP criado no editor visual com código POP-001, revisor, aprovador e leitura obrigatória da área');

  // 2. Busca de texto completo: sem acento, por prefixo e por código.
  for (const term of ['higienizacao', 'HIGIENIZAÇÃO', 'higien', 'pop-001', 'esfregar sabao']) {
    const result = await documents.search(rea, { q: term });
    assert.equal(result.items[0]?.id, created.id, `busca: ${term}`);
  }
  const hit = await documents.search(rea, { q: 'higienizacao' });
  assert.match(hit.items[0].snippet, /higienização/);
  assert.equal((await documents.search(rea, { q: 'inexistente-xyz' })).total, 0);
  pass('busca encontra com e sem acento, por prefixo e por código, com trecho destacado');

  // 3. Conteúdo do editor salvo e reindexado.
  const updated = markdownToDoc(`${body}\n- Usar papel toalha descartável`);
  await documents.saveContent(me, created.id, { contentJson: updated });
  assert.equal((await documents.search(rea, { q: 'papel toalha' })).items[0]?.id, created.id);
  await rejects(documents.saveContent(rea, created.id, { contentJson: updated }), /responsável|permissão|liberação/i, 'leitor não edita');
  pass('salvamento do editor atualiza a busca; quem não é responsável não edita');

  // 4. Fluxo assinado: revisão -> aprovação -> publicação.
  await documents.submit(me, created.id, {});
  let doc = await db.document.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(doc.status, 'WAITING_REVIEW');
  await rejects(documents.decide(apr, created.id, { decision: 'APPROVE', password: PASSWORD }), /não está atribuída|ainda não começou/, 'aprovador espera a revisão');
  await rejects(documents.decide(rev, created.id, { decision: 'APPROVE', password: 'errada' }), /Senha incorreta/, 'senha errada');
  await documents.decide(rev, created.id, { decision: 'APPROVE', password: PASSWORD });
  doc = await db.document.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(doc.status, 'WAITING_APPROVAL');
  await documents.decide(apr, created.id, { decision: 'APPROVE', password: PASSWORD, publishNow: true });
  doc = await db.document.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(doc.status, 'PUBLISHED');
  const version = await db.documentVersion.findFirstOrThrow({ where: { documentId: created.id, status: 'PUBLISHED' } });
  assert.equal(version.pdfSource, 'NATIVE');
  assert.match(version.contentHash, /^[0-9a-f]{64}$/);
  const signatures = await db.documentApproval.findMany({ where: { documentId: created.id, signatureHash: { not: null } } });
  assert.deepEqual(signatures.map((item) => item.approverRole).sort(), ['APPROVER', 'PUBLISHER', 'REVIEWER']);
  const pdfFile = await db.documentFile.findUniqueOrThrow({ where: { id: version.pdfFileId } });
  assert.equal(pdfFile.storageProvider, 'DATABASE');
  const blob = await db.documentBlob.findUniqueOrThrow({ where: { id: pdfFile.storageKey.slice(3) } });
  assert.equal(Buffer.from(blob.data).subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok((await PDFDocument.load(Buffer.from(blob.data))).getPageCount() >= 2);
  pass('fluxo assinado: senha conferida, ordem respeitada, PDF oficial no banco com 3 assinaturas');

  // 5. Leitura obrigatória: área com setores filhos, confirmação e adesão.
  const reads = await db.documentReadConfirmation.findMany({ where: { documentId: created.id, versionId: version.id } });
  assert.deepEqual(reads.map((row) => row.userId).sort(), [author.id, reader.id].sort());
  assert.ok(reads.every((row) => row.status === 'PENDING' && row.dueAt));
  assert.ok(sent.some((item) => item.userId === reader.id && item.link === `/documents/${created.id}/leitor`));
  const pending = await distribution.pendingFor(company.id, reader.id);
  assert.equal(pending.length, 1);
  await documents.confirmRead(rea, created.id);
  const summary = await distribution.summary(company.id, doc, reader.id);
  assert.equal(summary.confirmed, 1);
  assert.equal(summary.adhesion, 50);
  assert.equal(summary.mine.status, 'CONFIRMED');
  pass('leitura obrigatória distribuída para a área e o setor filho; confirmação conta na adesão');

  // 6. Indicadores e pendências.
  const overview = await documents.overview(rea);
  assert.equal(overview.published, 1);
  assert.equal(overview.mine.reads, 0);
  const inbox = await governance.inbox(me);
  assert.equal(inbox.reads.length, 1);
  pass('indicadores no banco e caixa de pendências por pessoa');

  // 7. Confidencial: invisível para quem não está autorizado e fora da IA.
  const secret = await documents.create(me, { title: 'Plano de contingência sigiloso', confidentiality: 'CONFIDENTIAL', content: 'Acesso restrito à diretoria', access: { userIds: [reviewer.id] } });
  await rejects(documents.getById(rea, secret.id), /acesso restrito/i, 'leitor não vê confidencial');
  assert.equal((await documents.search(rea, { q: 'contingencia' })).total, 0);
  assert.equal((await documents.search(rev, { q: 'contingencia' })).items[0]?.id, secret.id);
  assert.equal((await documents.search(mgr, { q: 'contingencia' })).items[0]?.id, secret.id);
  const aiWhere = await accessPolicy.visibilityWhere(mgr, { forAi: true });
  assert.equal(await db.document.count({ where: { id: secret.id, AND: [aiWhere] } }), 0);
  pass('confidencial: só autorizados e gestor do GED veem; nunca entra no contexto da IA');

  // 8. Pedido de alteração vira nova revisão; comparação entre revisões.
  const request = await changeRequests.create(rea, doc, { reason: 'Incluir uso de álcool 70% após a lavagem', sourceType: 'OTHER' });
  assert.equal((await changeRequests.pendingFor(company.id, author.id)).length, 1);
  await changeRequests.decide(me, request.id, { decision: 'ACCEPT', note: 'Vamos incluir' }, true);
  await documents.createRevision(me, created.id, { reason: 'Pedido de alteração aceito', changeRequestId: request.id });
  doc = await db.document.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(doc.status, 'IN_DEVELOPMENT');
  assert.equal(doc.version, 2);
  await documents.saveContent(me, created.id, { contentJson: markdownToDoc(`${body}\n- Aplicar álcool 70% após secar`) });
  await rejects(documents.submit(me, created.id, {}), /Descreva o que mudou/, 'revisão exige resumo');
  const comparison = await documents.compare(me, created.id);
  assert.equal(comparison.from.label, 'Rev. 00');
  assert.equal(comparison.to.label, 'Rev. 01');
  assert.match(comparison.to.text, /álcool 70%/);
  assert.doesNotMatch(comparison.from.text, /álcool/);
  pass('pedido de alteração aceito abre a Rev. 01; envio exige resumo; comparação mostra a mudança');

  // 9. Cópia baixada com marca d'água, Word exportado e análise de impacto.
  const copy = await documents.officialPdf(rea, created.id, {});
  assert.notEqual(Buffer.compare(copy.content, Buffer.from(blob.data)), 0);
  assert.equal(copy.content.subarray(0, 5).toString('latin1'), '%PDF-');
  const exported = await documents.exportDocx(me, created.id);
  assert.ok(isDocxBuffer(exported.buffer));
  const impact = await governance.impact(me, doc);
  assert.equal(impact.total, 0);
  await rejects(documents.exportDocx(rea, created.id), /Word editável é restrito/, 'leitor não baixa o Word');
  pass('cópia baixada com marca d’água, Word exportado para quem trabalha no documento, impacto calculado');

  // 10. Temporalidade e isolamento entre empresas.
  await governance.saveRetentionRule(mgr, { name: 'POP: 5 anos', retentionDays: 1825, disposition: 'DESCARTAR', typeConfigId: pop.id });
  const outdated = await documents.create(me, { title: 'POP antigo', typeConfigId: pop.id, content: 'Versão anterior' });
  await db.document.update({ where: { id: outdated.id }, data: { status: 'PUBLISHED' } });
  await documents.transition(me, outdated.id, 'OBSOLETE', { comment: 'Substituído pelo POP-001' });
  const retired = await db.document.findUniqueOrThrow({ where: { id: outdated.id } });
  assert.equal(retired.status, 'OBSOLETE');
  assert.ok(retired.retentionUntil && retired.retentionUntil > new Date(Date.now() + 1800 * 86_400_000));
  await rejects(documents.getById(out, created.id), /não encontrado/i, 'outra empresa');
  assert.equal((await documents.search(out, { q: 'higienizacao' })).total, 0);
  pass('obsoleto ganha prazo de guarda pela regra do tipo; outra empresa não enxerga nada');

  // 11. PDF pronto: o PDF principal não se confunde com anexos em PDF comuns.
  const pdfBytes = async (text) => {
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 200]).drawText(text, { x: 20, y: 100, size: 14 });
    return Buffer.from(await pdf.save());
  };
  const manual = await documents.create(me, { title: 'Manual do fornecedor do equipamento', contentFormat: 'FILE', approverIds: [approver.id] });
  assert.equal(manual.contentFormat, 'FILE');
  const annex = await documents.uploadBuffer(me, manual.id, { purpose: 'ATTACHMENT', fileName: 'certificado.pdf', mimeType: 'application/pdf', buffer: await pdfBytes('Certificado') });
  await rejects(documents.submit(me, manual.id, {}), /Anexe o PDF/, 'anexo comum não substitui o PDF principal');
  const main1 = await documents.uploadBuffer(me, manual.id, { purpose: 'MAIN_PDF', fileName: 'manual-v1.pdf', mimeType: 'application/pdf', buffer: await pdfBytes('Manual v1') });
  const main2 = await documents.uploadBuffer(me, manual.id, { purpose: 'MAIN_PDF', fileName: 'manual-v2.pdf', mimeType: 'application/pdf', buffer: await pdfBytes('Manual v2') });
  const manualFiles = await db.documentFile.findMany({ where: { documentId: manual.id } });
  assert.equal(manualFiles.find((file) => file.id === annex.id).deletedAt, null, 'anexo comum preservado');
  assert.ok(manualFiles.find((file) => file.id === main1.id).deletedAt, 'PDF principal anterior substituído');
  assert.equal(main2.protected, true);
  await documents.submit(me, manual.id, {});
  const frozen = await db.documentVersion.findFirstOrThrow({ where: { documentId: manual.id }, orderBy: { revisionNumber: 'desc' } });
  assert.equal(frozen.contentHash, main2.hashSha256, 'o hash assinado é o do PDF principal');
  await documents.decide(apr, manual.id, { decision: 'APPROVE', password: PASSWORD, publishNow: true });
  const manualVersion = await db.documentVersion.findFirstOrThrow({ where: { documentId: manual.id, status: 'PUBLISHED' } });
  assert.equal(manualVersion.pdfSource, 'FILE');
  pass('PDF pronto: anexo comum preservado, PDF principal trocado, hash assinado do arquivo e PDF oficial carimbado');

  // 12. Decisões concorrentes precisam enxergar as assinaturas já confirmadas.
  const parallel = await documents.create(me, { title: 'Aprovação concorrente', contentJson: markdownToDoc('Conteúdo congelado'), approverIds: [reviewer.id, approver.id] });
  await workflow.setParticipants(me, await db.document.findUniqueOrThrow({ where: { id: parallel.id } }), { reviewerIds: [], approverIds: [reviewer.id, approver.id], mode: 'PARALLEL' });
  await documents.submit(me, parallel.id, {});
  const staleParallel = await db.document.findUniqueOrThrow({ where: { id: parallel.id } });
  const concurrent = await Promise.all([rev, apr].map((person) => workflow.decide(person, staleParallel, { decision: 'APPROVE', password: PASSWORD })));
  assert.ok(concurrent.some((result) => result.status === 'APPROVED'));
  assert.equal((await db.document.findUniqueOrThrow({ where: { id: parallel.id } })).status, 'APPROVED');
  assert.equal(await db.documentApproval.count({ where: { documentId: parallel.id } }), 2);
  const duplicate = await documents.create(me, { title: 'Duplo clique de assinatura', contentJson: markdownToDoc('Assinar uma vez'), approverIds: [approver.id] });
  await documents.submit(me, duplicate.id, {});
  const staleDuplicate = await db.document.findUniqueOrThrow({ where: { id: duplicate.id } });
  const clicks = await Promise.allSettled([1, 2].map(() => workflow.decide(apr, staleDuplicate, { decision: 'APPROVE', password: PASSWORD })));
  assert.equal(clicks.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(await db.documentApproval.count({ where: { documentId: duplicate.id } }), 1);
  await rejects(documents.saveContent(me, duplicate.id, { contentJson: markdownToDoc('Edição atrasada') }), /bloqueado para edição/, 'salvamento após aprovação');
  pass('Postgres concorrente: duas aprovações concluem o fluxo, duplo clique assina uma vez e conteúdo aprovado fica bloqueado');

  // 13. Um envio calculado sobre uma cópia antiga não congela o texto anterior.
  const changed = await documents.create(me, { title: 'Envio versus edição', contentJson: markdownToDoc('Texto anterior'), approverIds: [approver.id] });
  const staleChanged = await db.document.findUniqueOrThrow({ where: { id: changed.id } });
  await documents.saveContent(me, changed.id, { contentJson: markdownToDoc('Texto corrigido') });
  await rejects(workflow.submit(me, staleChanged, {}), /mudou durante/, 'snapshot antigo');
  assert.equal(await db.documentWorkflowStep.count({ where: { documentId: changed.id } }), 0);
  const versionBeforePublish = await db.documentVersion.findFirstOrThrow({ where: { documentId: duplicate.id }, orderBy: { revisionNumber: 'desc' } });
  const publisherCount = () => db.documentApproval.count({ where: { documentId: duplicate.id, approverRole: 'PUBLISHER' } });
  const beforeFailure = await publisherCount();
  const originalPdf = render.officialPdf.bind(render);
  render.officialPdf = async () => { throw new Error('Falha simulada de renderização'); };
  await rejects(documents.publish(apr, duplicate.id, { password: PASSWORD }), /Falha simulada/, 'publicação que falha');
  render.officialPdf = originalPdf;
  assert.equal(await publisherCount(), beforeFailure, 'falha não registra assinatura de publicação');
  assert.equal((await db.documentVersion.findUniqueOrThrow({ where: { id: versionBeforePublish.id } })).status, 'APPROVED');
  pass('envio antigo é rejeitado; falha de PDF mantém a revisão aprovada sem registrar publicação ou assinatura');

  // 14. Descarte autorizado após o prazo elimina arquivos e todas as cópias do texto.
  await rejects(governance.dispose(mgr, retired, { reason: 'Teste' }), /prazo de guarda/, 'não descarta antes do prazo');
  const disposable = await documents.create(me, { title: 'Ensaio de temporalidade', contentJson: markdownToDoc('conteudodescartavelunico') });
  await documents.saveContent(me, disposable.id, { contentJson: markdownToDoc('conteudodescartavelunico atualizado') });
  const disposableFile = await documents.uploadBuffer(me, disposable.id, { purpose: 'ATTACHMENT', fileName: 'evidencia.pdf', mimeType: 'application/pdf', buffer: await pdfBytes('Evidencia sintetica') });
  const due = await db.document.update({ where: { id: disposable.id }, data: { status: 'OBSOLETE', retentionUntil: new Date(Date.now() - 1000) } });
  await governance.dispose(mgr, due, { reason: 'Prazo de guarda concluído no ensaio sintético' });
  const disposed = await db.document.findUniqueOrThrow({ where: { id: disposable.id } });
  assert.ok(disposed.disposedAt);
  assert.equal(disposed.contentJson, null);
  assert.equal(disposed.searchText, null);
  assert.equal(await db.documentAutosaveCheckpoint.count({ where: { documentId: disposable.id, content: { not: null } } }), 0);
  assert.equal(await db.documentBlob.count({ where: { id: disposableFile.storageKey.slice(3) } }), 0);
  assert.equal(await db.documentAuditLog.count({ where: { documentId: disposable.id, action: 'DISPOSED' } }), 1);
  assert.equal((await documents.search(me, { q: 'conteudodescartavelunico' })).total, 0);
  pass('temporalidade: bloqueia descarte antecipado e remove arquivos, índice e checkpoints após o prazo, mantendo auditoria');

  console.log('GED: ensaio de integração concluído.');
}

run()
  .catch((error) => {
    console.error('FAIL:', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
