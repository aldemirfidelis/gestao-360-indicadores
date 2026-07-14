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
const VERSION_PROC = 'G360-0.1';

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
