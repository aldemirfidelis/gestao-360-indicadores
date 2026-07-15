import { createHash } from 'crypto';

export const ESOCIAL_LAYOUT_VERSION = 'S-1.3';
export const ESOCIAL_SOURCE_URL = 'https://www.gov.br/esocial/pt-br/documentacao-tecnica';

export type EsocialEnvironment = 'PRODUCTION_RESTRICTED' | 'PRODUCTION';

export interface EsocialRemunerationItem {
  code: string;
  reference?: string | null;
  amount: string;
}

export interface EsocialRemunerationEvent {
  eventId: string;
  environment: EsocialEnvironment;
  periodRef: string;
  employerRegistration: string;
  establishmentRegistration: string;
  lotationCode: string;
  workerCpf: string;
  workerRegistration: string;
  categoryCode: string;
  paymentId: string;
  items: EsocialRemunerationItem[];
}

export interface EsocialBatchEvent {
  eventId: string;
  eventType: string;
  xml: string;
  xmlHash: string;
}

const NS_REMUN = 'http://www.esocial.gov.br/schema/evt/evtRemun/v_S_01_03_00';
const NS_TAB_RUBRICA = 'http://www.esocial.gov.br/schema/evt/evtTabRubrica/v_S_01_03_00';
const NS_FECHA = 'http://www.esocial.gov.br/schema/evt/evtFechaEvPer/v_S_01_03_00';
const NS_ADMISSAO = 'http://www.esocial.gov.br/schema/evt/evtAdmissao/v_S_01_03_00';
const NS_DESLIG = 'http://www.esocial.gov.br/schema/evt/evtDeslig/v_S_01_03_00';
const NS_PGTOS = 'http://www.esocial.gov.br/schema/evt/evtPgtos/v_S_01_03_00';
const VERSION_PROC = 'G360-0.1';

/** Motivo de desligamento (Tabela 19 do eSocial) por tipo interno de rescisão. */
export function terminationMotiveCode(kind: string): string {
  if (kind === 'PEDIDO') return '07'; // rescisão a pedido do empregado
  if (kind === 'ACORDO') return '33'; // rescisão por acordo (Lei 13.467)
  return '02'; // dispensa sem justa causa por iniciativa do empregador
}

/** Código eSocial tpRubr por natureza interna (1 provento, 2 desconto, 3 informativa, 4 info dedutora). */
export function rubricTypeCode(nature: string): '1' | '2' | '3' | '4' {
  if (nature === 'PROVENTO') return '1';
  if (nature === 'DESCONTO') return '2';
  if (nature === 'BASE') return '4';
  return '3'; // INFORMATIVA
}

export function onlyDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function hashXml(xml: string): string {
  return createHash('sha256').update(xml, 'utf8').digest('hex');
}

export function environmentCode(environment: EsocialEnvironment): '1' | '2' {
  return environment === 'PRODUCTION' ? '1' : '2';
}

export function buildEventId(args: { employerRegistration: string; createdAt: Date; seed: string }): string {
  const registration = onlyDigits(args.employerRegistration).padStart(14, '0').slice(0, 14);
  const instant = args.createdAt.toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = createHash('sha1').update(args.seed).digest('hex').slice(0, 5).toUpperCase();
  return `ID1${registration}${instant}${suffix}`;
}

export function decimalStringToEsocialMoney(value: string): string {
  const normalized = String(value ?? '0').trim().replace(',', '.');
  const negative = normalized.startsWith('-');
  const raw = negative ? normalized.slice(1) : normalized;
  const [integerRaw = '0', fractionRaw = ''] = raw.split('.');
  const integer = integerRaw.replace(/\D/g, '') || '0';
  const fraction = `${fractionRaw.replace(/\D/g, '')}00`.slice(0, 2);
  return `${negative ? '-' : ''}${Number(integer).toString()}.${fraction}`;
}

export function sanitizeEsocialCode(value: string | null | undefined, fallback: string, maxLength: number): string {
  const clean = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_.-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
  return clean || fallback;
}

export function buildS1200Xml(input: EsocialRemunerationEvent): string {
  const employerRoot = onlyDigits(input.employerRegistration).slice(0, 8);
  const establishment = onlyDigits(input.establishmentRegistration);
  const cpf = onlyDigits(input.workerCpf);
  const items = input.items
    .filter((item) => Number(decimalStringToEsocialMoney(item.amount)) > 0)
    .map((item) => {
      const reference = item.reference ? `<qtdRubr>${xmlEscape(referenceToQuantity(item.reference))}</qtdRubr>` : '';
      return [
        '              <itensRemun>',
        `                <codRubr>${xmlEscape(sanitizeEsocialCode(item.code, 'G360', 30))}</codRubr>`,
        '                <ideTabRubr>G360</ideTabRubr>',
        reference,
        `                <vrRubr>${decimalStringToEsocialMoney(item.amount)}</vrRubr>`,
        '                <indApurIR>0</indApurIR>',
        '              </itensRemun>',
      ].filter(Boolean).join('\n');
    })
    .join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<eSocial xmlns="${NS_REMUN}">`,
    `  <evtRemun Id="${xmlEscape(input.eventId)}">`,
    '    <ideEvento>',
    '      <indRetif>1</indRetif>',
    '      <indApuracao>1</indApuracao>',
    `      <perApur>${xmlEscape(input.periodRef)}</perApur>`,
    `      <tpAmb>${environmentCode(input.environment)}</tpAmb>`,
    '      <procEmi>1</procEmi>',
    `      <verProc>${VERSION_PROC}</verProc>`,
    '    </ideEvento>',
    '    <ideEmpregador>',
    '      <tpInsc>1</tpInsc>',
    `      <nrInsc>${xmlEscape(employerRoot)}</nrInsc>`,
    '    </ideEmpregador>',
    '    <ideTrabalhador>',
    `      <cpfTrab>${xmlEscape(cpf)}</cpfTrab>`,
    '    </ideTrabalhador>',
    '    <dmDev>',
    `      <ideDmDev>${xmlEscape(sanitizeEsocialCode(input.paymentId, 'G360', 30))}</ideDmDev>`,
    `      <codCateg>${xmlEscape(input.categoryCode)}</codCateg>`,
    '      <infoPerApur>',
    '        <ideEstabLot>',
    '          <tpInsc>1</tpInsc>',
    `          <nrInsc>${xmlEscape(establishment)}</nrInsc>`,
    `          <codLotacao>${xmlEscape(sanitizeEsocialCode(input.lotationCode, 'G360-GERAL', 30))}</codLotacao>`,
    '          <remunPerApur>',
    `            <matricula>${xmlEscape(sanitizeEsocialCode(input.workerRegistration, 'SEM-MATRICULA', 30))}</matricula>`,
    items,
    '          </remunPerApur>',
    '        </ideEstabLot>',
    '      </infoPerApur>',
    '    </dmDev>',
    '  </evtRemun>',
    '</eSocial>',
  ].join('\n');
}

export interface EsocialRubricTableItem {
  code: string;
  description: string;
  nature: string;
  /** Início de validade YYYY-MM (competência a partir da qual a rubrica vale). */
  validityRef: string;
}

export interface EsocialRubricTableEvent {
  eventId: string;
  environment: EsocialEnvironment;
  employerRegistration: string;
  rubrics: EsocialRubricTableItem[];
}

/**
 * S-1010 (Tabela de Rubricas) simplificado: espelha as rubricas internas para
 * conferência antes de qualquer transmissão. ⚠️ natRubr e os códigos oficiais
 * de incidência (codIncCP/IRRF/FGTS) exigem parametrização por rubrica — aqui
 * saem em branco e devem ser preenchidos com validação da contabilidade.
 */
export function buildS1010Xml(input: EsocialRubricTableEvent): string {
  const employerRoot = onlyDigits(input.employerRegistration).slice(0, 8);
  const rubrics = input.rubrics
    .map((rubric) =>
      [
        '    <infoRubrica>',
        '      <inclusao>',
        '        <ideRubrica>',
        `          <codRubr>${xmlEscape(sanitizeEsocialCode(rubric.code, 'G360', 30))}</codRubr>`,
        '          <ideTabRubr>G360</ideTabRubr>',
        `          <iniValid>${xmlEscape(rubric.validityRef)}</iniValid>`,
        '        </ideRubrica>',
        '        <dadosRubrica>',
        `          <dscRubr>${xmlEscape(rubric.description.slice(0, 100))}</dscRubr>`,
        '          <natRubr></natRubr>',
        `          <tpRubr>${rubricTypeCode(rubric.nature)}</tpRubr>`,
        '          <codIncCP></codIncCP>',
        '          <codIncIRRF></codIncIRRF>',
        '          <codIncFGTS></codIncFGTS>',
        '        </dadosRubrica>',
        '      </inclusao>',
        '    </infoRubrica>',
      ].join('\n'),
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${NS_TAB_RUBRICA}">`,
    `  <evtTabRubrica Id="${xmlEscape(input.eventId)}">`,
    '    <ideEvento>',
    `      <tpAmb>${environmentCode(input.environment)}</tpAmb>`,
    '      <procEmi>1</procEmi>',
    `      <verProc>${VERSION_PROC}</verProc>`,
    '    </ideEvento>',
    '    <ideEmpregador>',
    '      <tpInsc>1</tpInsc>',
    `      <nrInsc>${xmlEscape(employerRoot)}</nrInsc>`,
    '    </ideEmpregador>',
    rubrics,
    '  </evtTabRubrica>',
    '</eSocial>',
  ].join('\n');
}

export interface EsocialClosingEvent {
  eventId: string;
  environment: EsocialEnvironment;
  periodRef: string;
  employerRegistration: string;
  responsibleName: string;
  responsibleCpf: string;
  /** Houve eventos de remuneração no período? (evtRemun S/N). */
  hasRemuneration: boolean;
}

/**
 * S-1299 (Fechamento dos Eventos Periódicos) simplificado: encerra a apuração
 * do período para conferência interna. Não solicita totalizadores ao governo.
 */
export function buildS1299Xml(input: EsocialClosingEvent): string {
  const employerRoot = onlyDigits(input.employerRegistration).slice(0, 8);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${NS_FECHA}">`,
    `  <evtFechaEvPer Id="${xmlEscape(input.eventId)}">`,
    '    <ideEvento>',
    '      <indApuracao>1</indApuracao>',
    `      <perApur>${xmlEscape(input.periodRef)}</perApur>`,
    `      <tpAmb>${environmentCode(input.environment)}</tpAmb>`,
    '      <procEmi>1</procEmi>',
    `      <verProc>${VERSION_PROC}</verProc>`,
    '    </ideEvento>',
    '    <ideEmpregador>',
    '      <tpInsc>1</tpInsc>',
    `      <nrInsc>${xmlEscape(employerRoot)}</nrInsc>`,
    '    </ideEmpregador>',
    '    <ideRespInf>',
    `      <nmResp>${xmlEscape(input.responsibleName.slice(0, 70))}</nmResp>`,
    `      <cpfResp>${xmlEscape(onlyDigits(input.responsibleCpf))}</cpfResp>`,
    '    </ideRespInf>',
    '    <infoFech>',
    `      <evtRemun>${input.hasRemuneration ? 'S' : 'N'}</evtRemun>`,
    '      <evtPgtos>N</evtPgtos>',
    '      <evtAqProd>N</evtAqProd>',
    '      <evtComProd>N</evtComProd>',
    '      <evtContratAvNP>N</evtContratAvNP>',
    '      <evtInfoComplPer>N</evtInfoComplPer>',
    '    </infoFech>',
    '  </evtFechaEvPer>',
    '</eSocial>',
  ].join('\n');
}

export interface EsocialAdmissionEvent {
  eventId: string;
  environment: EsocialEnvironment;
  employerRegistration: string;
  workerCpf: string;
  workerName: string;
  birthDate: string | null; // YYYY-MM-DD
  admissionDate: string; // YYYY-MM-DD
  workerRegistration: string;
  categoryCode: string;
  cboCode: string | null;
  monthlySalary: string; // valor decimal "0.00"
  /** Já mapeados p/ os códigos do eSocial (ver mapSexo/mapRacaCor/...). */
  sexo: 'M' | 'F';
  racaCor: string;
  estadoCivil: string;
  grauInstrucao: string;
  pisPasep: string | null;
  /** Código IBGE do município de nascimento (7 dígitos), se disponível. */
  birthCityCode: string | null;
  birthUf: string | null;
}

/**
 * S-2200 (Admissão / Cadastramento Inicial do Vínculo). Preenche os campos
 * obrigatórios com os dados do prontuário mapeados para as tabelas do eSocial.
 * ⚠️ O que ainda não existe no cadastro (ex.: município de nascimento por código
 * IBGE, CBO) é sinalizado como pendência pelo serviço; valide no XSD oficial.
 */
export function buildS2200Xml(input: EsocialAdmissionEvent): string {
  const employerRoot = onlyDigits(input.employerRegistration).slice(0, 8);
  const nascimentoLoc = input.birthCityCode
    ? [`        <codMunic>${xmlEscape(input.birthCityCode)}</codMunic>`, `        <uf>${xmlEscape(input.birthUf ?? '')}</uf>`]
    : [];
  const pis = onlyDigits(input.pisPasep ?? '');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${NS_ADMISSAO}">`,
    `  <evtAdmissao Id="${xmlEscape(input.eventId)}">`,
    '    <ideEvento>',
    `      <tpAmb>${environmentCode(input.environment)}</tpAmb>`,
    '      <procEmi>1</procEmi>',
    `      <verProc>${VERSION_PROC}</verProc>`,
    '    </ideEvento>',
    '    <ideEmpregador>',
    '      <tpInsc>1</tpInsc>',
    `      <nrInsc>${xmlEscape(employerRoot)}</nrInsc>`,
    '    </ideEmpregador>',
    '    <trabalhador>',
    `      <cpfTrab>${xmlEscape(onlyDigits(input.workerCpf))}</cpfTrab>`,
    `      <nmTrab>${xmlEscape(input.workerName.slice(0, 70))}</nmTrab>`,
    `      <sexo>${input.sexo}</sexo>`,
    `      <racaCor>${xmlEscape(input.racaCor)}</racaCor>`,
    `      <estCiv>${xmlEscape(input.estadoCivil)}</estCiv>`,
    `      <grauInstr>${xmlEscape(input.grauInstrucao)}</grauInstr>`,
    '      <nascimento>',
    `        <dtNascto>${xmlEscape(input.birthDate ?? '')}</dtNascto>`,
    ...nascimentoLoc,
    '        <paisNascto>105</paisNascto>',
    '        <paisNac>105</paisNac>',
    '      </nascimento>',
    '    </trabalhador>',
    `    <vinculo matricula="${xmlEscape(sanitizeEsocialCode(input.workerRegistration, 'SEM-MATRICULA', 30))}">`,
    '      <tpRegTrab>1</tpRegTrab>',
    '      <tpRegPrev>1</tpRegPrev>',
    ...(pis ? ['      <infoRegimeTrab>', '        <infoCeletista>', `          <dtAdm>${xmlEscape(input.admissionDate)}</dtAdm>`, '          <tpAdmissao>1</tpAdmissao>', '          <tpRegJor>1</tpRegJor>', '          <natAtividade>1</natAtividade>', '        </infoCeletista>', '      </infoRegimeTrab>'] : []),
    '      <infoContrato>',
    `        <nmCargo>${xmlEscape('Cargo')}</nmCargo>`,
    ...(input.cboCode ? [`        <CBOCargo>${xmlEscape(input.cboCode)}</CBOCargo>`] : []),
    `        <codCateg>${xmlEscape(input.categoryCode)}</codCateg>`,
    '        <remuneracao>',
    `          <vrSalFx>${decimalStringToEsocialMoney(input.monthlySalary)}</vrSalFx>`,
    '          <undSalFixo>5</undSalFixo>',
    '        </remuneracao>',
    '        <duracao>',
    '          <tpContr>1</tpContr>',
    '        </duracao>',
    `        <dtAdm>${xmlEscape(input.admissionDate)}</dtAdm>`,
    '      </infoContrato>',
    '    </vinculo>',
    '  </evtAdmissao>',
    '</eSocial>',
  ].join('\n');
}

export interface EsocialTerminationEvent {
  eventId: string;
  environment: EsocialEnvironment;
  periodRef: string;
  employerRegistration: string;
  workerCpf: string;
  workerRegistration: string;
  terminationDate: string; // YYYY-MM-DD
  motiveCode: string;
  paymentId: string;
  items: EsocialRemunerationItem[];
}

/**
 * S-2299 (Desligamento) simplificado, para conferência interna: motivo, data e
 * as verbas rescisórias como itensRemun. ⚠️ Não projeta aviso/estabilidade nem
 * substitui a homologação; incidências detalhadas exigem validação.
 */
export function buildS2299Xml(input: EsocialTerminationEvent): string {
  const employerRoot = onlyDigits(input.employerRegistration).slice(0, 8);
  const items = input.items
    .filter((item) => Number(decimalStringToEsocialMoney(item.amount)) > 0)
    .map((item) =>
      [
        '            <itensRemun>',
        `              <codRubr>${xmlEscape(sanitizeEsocialCode(item.code, 'G360', 30))}</codRubr>`,
        '              <ideTabRubr>G360</ideTabRubr>',
        `              <vrRubr>${decimalStringToEsocialMoney(item.amount)}</vrRubr>`,
        '            </itensRemun>',
      ].join('\n'),
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${NS_DESLIG}">`,
    `  <evtDeslig Id="${xmlEscape(input.eventId)}">`,
    '    <ideEvento>',
    '      <indRetif>1</indRetif>',
    `      <tpAmb>${environmentCode(input.environment)}</tpAmb>`,
    '      <procEmi>1</procEmi>',
    `      <verProc>${VERSION_PROC}</verProc>`,
    '    </ideEvento>',
    '    <ideEmpregador>',
    '      <tpInsc>1</tpInsc>',
    `      <nrInsc>${xmlEscape(employerRoot)}</nrInsc>`,
    '    </ideEmpregador>',
    '    <ideVinculo>',
    `      <cpfTrab>${xmlEscape(onlyDigits(input.workerCpf))}</cpfTrab>`,
    `      <matricula>${xmlEscape(sanitizeEsocialCode(input.workerRegistration, 'SEM-MATRICULA', 30))}</matricula>`,
    '    </ideVinculo>',
    '    <infoDeslig>',
    `      <mtvDeslig>${xmlEscape(input.motiveCode)}</mtvDeslig>`,
    `      <dtDeslig>${xmlEscape(input.terminationDate)}</dtDeslig>`,
    '      <indPagtoAPI>N</indPagtoAPI>',
    '      <verbasResc>',
    `        <dmDev>`,
    `          <ideDmDev>${xmlEscape(sanitizeEsocialCode(input.paymentId, 'G360', 30))}</ideDmDev>`,
    '          <infoPerApur>',
    '            <ideEstabLot>',
    '              <tpInsc>1</tpInsc>',
    `              <nrInsc>${xmlEscape(employerRoot)}</nrInsc>`,
    '              <codLotacao>G360-GERAL</codLotacao>',
    items,
    '            </ideEstabLot>',
    '          </infoPerApur>',
    '        </dmDev>',
    '      </verbasResc>',
    '    </infoDeslig>',
    '  </evtDeslig>',
    '</eSocial>',
  ].join('\n');
}

export interface EsocialPaymentEvent {
  eventId: string;
  environment: EsocialEnvironment;
  periodRef: string; // competência de apuração YYYY-MM
  employerRegistration: string;
  workerCpf: string;
  paymentDate: string; // YYYY-MM-DD (regime de caixa — fato gerador do IRRF)
  paymentId: string; // ideDmDev, deve casar com o S-1200 da mesma competência
  netPaid: string; // valor líquido pago (decimal "0.00")
  irrf: string; // IRRF retido no pagamento (decimal "0.00")
}

/**
 * S-1210 (Pagamentos de Rendimentos do Trabalho) simplificado, para conferência
 * interna. Informa o pagamento (regime de caixa) vinculado à apuração do S-1200
 * e o IRRF retido no ato. ⚠️ O detalhamento de rendimentos/deduções do IRRF é
 * simplificado (só o total) e exige validação antes de qualquer transmissão.
 */
export function buildS1210Xml(input: EsocialPaymentEvent): string {
  const employerRoot = onlyDigits(input.employerRegistration).slice(0, 8);
  const irrfValue = decimalStringToEsocialMoney(input.irrf);
  const irrfBlock = Number(irrfValue) > 0
    ? [
        '        <detPgtoFl>',
        '          <detIR>',
        `            <vrIRRF>${irrfValue}</vrIRRF>`,
        '          </detIR>',
        '        </detPgtoFl>',
      ].join('\n')
    : '';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${NS_PGTOS}">`,
    `  <evtPgtos Id="${xmlEscape(input.eventId)}">`,
    '    <ideEvento>',
    '      <indApuracao>1</indApuracao>',
    `      <perApur>${xmlEscape(input.periodRef)}</perApur>`,
    `      <tpAmb>${environmentCode(input.environment)}</tpAmb>`,
    '      <procEmi>1</procEmi>',
    `      <verProc>${VERSION_PROC}</verProc>`,
    '    </ideEvento>',
    '    <ideEmpregador>',
    '      <tpInsc>1</tpInsc>',
    `      <nrInsc>${xmlEscape(employerRoot)}</nrInsc>`,
    '    </ideEmpregador>',
    '    <ideBenef>',
    `      <cpfBenef>${xmlEscape(onlyDigits(input.workerCpf))}</cpfBenef>`,
    '      <infoPgto>',
    `        <dtPgto>${xmlEscape(input.paymentDate)}</dtPgto>`,
    '        <tpPgto>1</tpPgto>',
    `        <perRef>${xmlEscape(input.periodRef)}</perRef>`,
    `        <ideDmDev>${xmlEscape(sanitizeEsocialCode(input.paymentId, 'G360', 30))}</ideDmDev>`,
    `        <vrLiq>${decimalStringToEsocialMoney(input.netPaid)}</vrLiq>`,
    irrfBlock,
    '      </infoPgto>',
    '    </ideBenef>',
    '  </evtPgtos>',
    '</eSocial>',
  ].filter((line) => line !== '').join('\n');
}

export function buildInternalBatchXml(input: {
  batchId: string;
  environment: EsocialEnvironment;
  layoutVersion: string;
  events: EsocialBatchEvent[];
}): string {
  const events = input.events
    .map((event) => [
      `  <evento id="${xmlEscape(event.eventId)}" tipo="${xmlEscape(event.eventType)}" sha256="${event.xmlHash}">`,
      `    <![CDATA[${event.xml.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`,
      '  </evento>',
    ].join('\n'))
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<g360EsocialLote xmlns="urn:g360:payroll:esocial:batch:v1">',
    `  <id>${xmlEscape(input.batchId)}</id>`,
    `  <ambiente>${environmentCode(input.environment)}</ambiente>`,
    `  <layout>${xmlEscape(input.layoutVersion)}</layout>`,
    `  <totalEventos>${input.events.length}</totalEventos>`,
    events,
    '</g360EsocialLote>',
  ].join('\n');
}

// ------------------------------ transmissão (envelope de lote + SOAP) ------------------------------

// ⚠️ Namespaces/versões do serviço mudam entre versões do eSocial. Estes são os
// modelos estruturais e DEVEM ser confirmados contra o WSDL oficial vigente
// antes de transmitir em produção.
const NS_LOTE_ENVIO = 'http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1';
const NS_WS_ENVIO = 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/v1_1_0';
const NS_WS_CONSULTA = 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/consulta/retornoProcessamento/v1_0_0';
const NS_SOAP12 = 'http://www.w3.org/2003/05/soap-envelope';

/** Remove o prólogo <?xml ...?> de um documento (para embutir num envelope). */
function stripXmlProlog(xml: string): string {
  return xml.replace(/^\s*<\?xml[^>]*\?>\s*/i, '').trim();
}

/**
 * Envelope de envio de lote (grupo 1, até 50 eventos) com os eventos JÁ
 * ASSINADOS. O empregador é o contribuinte; o transmissor pode ser o próprio
 * empregador ou um procurador (mesmo CNPJ por padrão).
 */
export function buildLoteEnvelopeXml(input: {
  employerRegistration: string;
  transmitterRegistration?: string;
  signedEvents: Array<{ eventId: string; signedXml: string }>;
}): string {
  const employerRoot = onlyDigits(input.employerRegistration).slice(0, 8);
  const transmitter = onlyDigits(input.transmitterRegistration || input.employerRegistration).slice(0, 14);
  const eventos = input.signedEvents
    .map((event) => [
      `    <evento Id="${xmlEscape(event.eventId)}">`,
      stripXmlProlog(event.signedXml),
      '    </evento>',
    ].join('\n'))
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${NS_LOTE_ENVIO}">`,
    '  <envioLoteEventos grupo="1">',
    '    <ideEmpregador>',
    '      <tpInsc>1</tpInsc>',
    `      <nrInsc>${xmlEscape(employerRoot)}</nrInsc>`,
    '    </ideEmpregador>',
    '    <ideTransmissor>',
    '      <tpInsc>1</tpInsc>',
    `      <nrInsc>${xmlEscape(transmitter)}</nrInsc>`,
    '    </ideTransmissor>',
    '    <eventos>',
    eventos,
    '    </eventos>',
    '  </envioLoteEventos>',
    '</eSocial>',
  ].join('\n');
}

/** Payload de consulta do processamento de um lote pelo protocolo de envio. */
export function buildConsultaLoteXml(protocol: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${NS_WS_CONSULTA}">`,
    '  <consultaLoteEventos>',
    `    <protocoloEnvio>${xmlEscape(protocol)}</protocoloEnvio>`,
    '  </consultaLoteEventos>',
    '</eSocial>',
  ].join('\n');
}

/** Envelope SOAP 1.2 para a operação EnviarLoteEventos. */
export function buildSoapEnvelope(loteXml: string, operation: 'enviar' | 'consultar' = 'enviar'): string {
  const inner = stripXmlProlog(loteXml);
  if (operation === 'consultar') {
    return [
      `<soap12:Envelope xmlns:soap12="${NS_SOAP12}">`,
      '  <soap12:Body>',
      `    <ConsultarLoteEventos xmlns="${NS_WS_CONSULTA}">`,
      `      <consulta>${inner}</consulta>`,
      '    </ConsultarLoteEventos>',
      '  </soap12:Body>',
      '</soap12:Envelope>',
    ].join('\n');
  }
  return [
    `<soap12:Envelope xmlns:soap12="${NS_SOAP12}">`,
    '  <soap12:Body>',
    `    <EnviarLoteEventos xmlns="${NS_WS_ENVIO}">`,
    `      <loteEventos>${inner}</loteEventos>`,
    '    </EnviarLoteEventos>',
    '  </soap12:Body>',
    '</soap12:Envelope>',
  ].join('\n');
}

/** Extrai o número do protocolo de uma resposta de envio (best-effort, tolerante a namespace). */
export function extractProtocol(responseXml: string): string | null {
  const match = responseXml.match(/<\s*(?:[\w-]+:)?protocoloEnvio\s*>([^<]+)</i) ?? responseXml.match(/<\s*(?:[\w-]+:)?nrProtocolo\s*>([^<]+)</i);
  return match ? match[1].trim() : null;
}

// ------------------------------ mapeamentos de código (tabelas eSocial) ------------------------------

/** Sexo eSocial: 'M' | 'F' a partir de código ou rótulo interno. */
export function mapSexo(value: string | null | undefined): 'M' | 'F' {
  const v = String(value ?? '').trim().toUpperCase();
  if (v.startsWith('F')) return 'F';
  return 'M';
}

/** Raça/cor (Tabela 12): 1 Branca · 2 Preta · 3 Parda · 4 Amarela · 5 Indígena · 6 Não informado. */
export function mapRacaCor(value: string | null | undefined): string {
  const v = String(value ?? '').trim().toUpperCase();
  if (/^[1-6]$/.test(v)) return v;
  const byLabel: Record<string, string> = { BRANCA: '1', PRETA: '2', PARDA: '3', AMARELA: '4', INDIGENA: '5', 'INDÍGENA': '5' };
  return byLabel[v] ?? '6';
}

/** Estado civil (S-2200): 1 Solteiro · 2 Casado · 3 Divorciado · 4 Separado · 5 Viúvo. */
export function mapEstadoCivil(value: string | null | undefined): string {
  const v = String(value ?? '').trim().toUpperCase();
  if (/^[1-5]$/.test(v)) return v;
  const byLabel: Record<string, string> = {
    SOLTEIRO: '1', CASADO: '2', UNIAO_ESTAVEL: '2', 'UNIÃO ESTÁVEL': '2',
    DIVORCIADO: '3', SEPARADO: '4', VIUVO: '5', 'VIÚVO': '5',
  };
  return byLabel[v] ?? '1';
}

/** Grau de instrução (Tabela 18, subconjunto usual): 01 analf..12 pós/doutorado. */
export function mapGrauInstrucao(value: string | null | undefined): string {
  const v = String(value ?? '').trim().toUpperCase();
  if (/^\d{2}$/.test(v)) return v;
  if (v.includes('ANALFAB')) return '01';
  if (v.includes('FUNDAMENTAL') || v.includes('FUNDAMENTAL')) return '07';
  if (v.includes('MEDIO') || v.includes('MÉDIO') || v.includes('TECNICO') || v.includes('TÉCNICO')) return '09';
  if (v.includes('POS') || v.includes('PÓS') || v.includes('MESTRADO') || v.includes('DOUTORADO') || v.includes('ESPECIALIZ')) return '12';
  if (v.includes('SUPERIOR') || v.includes('GRADUAC') || v.includes('GRADUAÇ')) return '11';
  return '09';
}

// ------------------------------ totalizadores (retornos S-5001/2/11/13) ------------------------------

/** Soma (em centavos) todas as ocorrências de uma tag monetária, tolerante a prefixo de namespace. */
export function sumMoneyTag(xml: string, tag: string): number {
  const re = new RegExp(`<\\s*(?:[\\w-]+:)?${tag}\\s*>([^<]+)<`, 'gi');
  let total = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const cents = Math.round(Number(String(match[1]).trim().replace(',', '.')) * 100);
    if (Number.isFinite(cents)) total += cents;
  }
  return total;
}

export interface OfficialTotalizers {
  present: string[]; // eventos totalizadores detectados
  s5001CpSegCents: number; // INSS do segurado (S-5001)
  s5002IrrfCents: number; // IRRF (S-5002)
  s5011CpBaseCents: number; // base CP consolidada (S-5011)
  s5011CpSegCents: number; // CP do segurado consolidada (S-5011)
  s5013FgtsBaseCents: number; // base FGTS (S-5013)
  s5013FgtsCents: number; // FGTS (S-5013)
}

/**
 * Extrai os totalizadores oficiais de um retorno do eSocial (best-effort,
 * tolerante a namespace). Os valores exatos dependem do leiaute vigente e devem
 * ser conferidos; serve para reconciliar contra o cálculo interno.
 */
export function parseOfficialTotalizers(responseXml: string): OfficialTotalizers {
  const present: string[] = [];
  for (const [evt, label] of [
    ['evtBasesTrab', 'S-5001'],
    ['evtIrrf', 'S-5002'],
    ['evtIrrfBenef', 'S-5002'],
    ['evtCS', 'S-5011'],
    ['evtFGTS', 'S-5013'],
  ] as const) {
    if (new RegExp(`<\\s*(?:[\\w-]+:)?${evt}\\b`, 'i').test(responseXml) && !present.includes(label)) present.push(label);
  }
  // sumMoneyTag já é case-insensitive — não somar variantes de caixa (duplicaria).
  return {
    present,
    s5001CpSegCents: sumMoneyTag(responseXml, 'vrCpSeg'),
    s5002IrrfCents: sumMoneyTag(responseXml, 'vrIrrf'),
    s5011CpBaseCents: sumMoneyTag(responseXml, 'vrBcCp00'),
    s5011CpSegCents: sumMoneyTag(responseXml, 'vrCpSegTransf'),
    s5013FgtsBaseCents: sumMoneyTag(responseXml, 'vrBcFgts'),
    s5013FgtsCents: sumMoneyTag(responseXml, 'vrFgts'),
  };
}

export function xmlEscape(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function referenceToQuantity(reference: string): string {
  const match = reference.match(/\d+(?:[,.]\d+)?/);
  return match ? decimalStringToEsocialMoney(match[0]) : '1.00';
}
