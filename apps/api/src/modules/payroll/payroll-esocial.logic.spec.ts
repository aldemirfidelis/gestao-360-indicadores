import { describe, expect, it } from 'vitest';
import {
  buildEventId,
  buildInternalBatchXml,
  buildLoteEnvelopeXml,
  buildS1010Xml,
  buildS1200Xml,
  buildS1210Xml,
  buildS1299Xml,
  buildS2200Xml,
  buildS2299Xml,
  buildSoapEnvelope,
  decimalStringToEsocialMoney,
  environmentCode,
  extractProtocol,
  hashXml,
  rubricTypeCode,
  sanitizeEsocialCode,
  terminationMotiveCode,
} from './payroll-esocial.logic';

describe('payroll-esocial.logic', () => {
  it('gera Id de evento deterministico no tamanho esperado', () => {
    const id = buildEventId({
      employerRegistration: '12.345.678/0001-90',
      createdAt: new Date('2026-07-14T12:34:56Z'),
      seed: 'worker-1:S-1200',
    });

    expect(id).toMatch(/^ID1\d{14}20260714123456[A-F0-9]{5}$/);
    expect(id).toHaveLength(36);
  });

  it('normaliza dinheiro, codigos e ambiente', () => {
    expect(decimalStringToEsocialMoney('00123.4')).toBe('123.40');
    expect(decimalStringToEsocialMoney('987,65')).toBe('987.65');
    expect(sanitizeEsocialCode(' Rubrica & especial ', 'FALLBACK', 30)).toBe('Rubrica---especial');
    expect(environmentCode('PRODUCTION_RESTRICTED')).toBe('2');
    expect(environmentCode('PRODUCTION')).toBe('1');
  });

  it('monta S-1200 com escapamento e hash estavel', () => {
    const xml = buildS1200Xml({
      eventId: 'ID11234567800019020260714123456ABCDE',
      environment: 'PRODUCTION_RESTRICTED',
      periodRef: '2026-07',
      employerRegistration: '12.345.678/0001-90',
      establishmentRegistration: '12.345.678/0001-90',
      lotationCode: 'ADM & RH',
      workerCpf: '123.456.789-09',
      workerRegistration: 'M-001',
      categoryCode: '101',
      paymentId: 'DM-2026-07',
      items: [
        { code: '1000', reference: '220h', amount: '3000.00' },
        { code: '5501', reference: null, amount: '253.41' },
      ],
    });

    expect(xml).toContain('<evtRemun Id="ID11234567800019020260714123456ABCDE">');
    expect(xml).toContain('<tpAmb>2</tpAmb>');
    expect(xml).toContain('<nrInsc>12345678</nrInsc>');
    expect(xml).toContain('<cpfTrab>12345678909</cpfTrab>');
    expect(xml).toContain('<codLotacao>ADM---RH</codLotacao>');
    expect(xml).toContain('<vrRubr>3000.00</vrRubr>');
    expect(hashXml(xml)).toHaveLength(64);
  });

  it('monta lote interno sem fingir envelope oficial de transmissao', () => {
    const eventXml = '<eSocial><evtRemun Id="ID1">ok</evtRemun></eSocial>';
    const batch = buildInternalBatchXml({
      batchId: 'batch-1',
      environment: 'PRODUCTION_RESTRICTED',
      layoutVersion: 'S-1.3',
      events: [{ eventId: 'ID1', eventType: 'S-1200', xml: eventXml, xmlHash: hashXml(eventXml) }],
    });

    expect(batch).toContain('urn:g360:payroll:esocial:batch:v1');
    expect(batch).toContain('<ambiente>2</ambiente>');
    expect(batch).toContain('<totalEventos>1</totalEventos>');
    expect(batch).toContain('<![CDATA[<eSocial>');
  });

  it('mapeia tpRubr por natureza interna', () => {
    expect(rubricTypeCode('PROVENTO')).toBe('1');
    expect(rubricTypeCode('DESCONTO')).toBe('2');
    expect(rubricTypeCode('BASE')).toBe('4');
    expect(rubricTypeCode('INFORMATIVA')).toBe('3');
  });

  it('monta S-1010 (tabela de rubricas) por rubrica', () => {
    const xml = buildS1010Xml({
      eventId: 'ID11234567800019020260714123456ABCDE',
      environment: 'PRODUCTION_RESTRICTED',
      employerRegistration: '12.345.678/0001-90',
      rubrics: [
        { code: '1000', description: 'Salário base', nature: 'PROVENTO', validityRef: '2026-07' },
        { code: '5501', description: 'INSS', nature: 'DESCONTO', validityRef: '2026-07' },
      ],
    });

    expect(xml).toContain('<evtTabRubrica Id="ID11234567800019020260714123456ABCDE">');
    expect(xml).toContain('<codRubr>1000</codRubr>');
    expect(xml).toContain('<dscRubr>Salário base</dscRubr>');
    expect(xml).toContain('<tpRubr>1</tpRubr>');
    expect(xml).toContain('<tpRubr>2</tpRubr>');
    expect(xml).toContain('<iniValid>2026-07</iniValid>');
    // dois blocos de rubrica
    expect(xml.match(/<infoRubrica>/g)).toHaveLength(2);
    expect(hashXml(xml)).toHaveLength(64);
  });

  it('monta S-1299 (fechamento) com responsável e flags de período', () => {
    const xml = buildS1299Xml({
      eventId: 'ID11234567800019020260714123456FECHA',
      environment: 'PRODUCTION_RESTRICTED',
      periodRef: '2026-07',
      employerRegistration: '12.345.678/0001-90',
      responsibleName: 'Maria da Folha',
      responsibleCpf: '111.222.333-44',
      hasRemuneration: true,
    });

    expect(xml).toContain('<evtFechaEvPer Id="ID11234567800019020260714123456FECHA">');
    expect(xml).toContain('<perApur>2026-07</perApur>');
    expect(xml).toContain('<cpfResp>11122233344</cpfResp>');
    expect(xml).toContain('<evtRemun>S</evtRemun>');
    expect(xml).toContain('<evtPgtos>N</evtPgtos>');
  });

  it('mapeia o motivo de desligamento (Tabela 19)', () => {
    expect(terminationMotiveCode('DISPENSA_SEM_JUSTA_CAUSA')).toBe('02');
    expect(terminationMotiveCode('PEDIDO')).toBe('07');
    expect(terminationMotiveCode('ACORDO')).toBe('33');
  });

  it('monta S-2200 (admissão) com dados cadastrais e contratuais', () => {
    const xml = buildS2200Xml({
      eventId: 'ID11234567800019020260714123456ADM01',
      environment: 'PRODUCTION_RESTRICTED',
      employerRegistration: '12.345.678/0001-90',
      workerCpf: '123.456.789-09',
      workerName: 'Ana Silva',
      birthDate: '1990-05-20',
      admissionDate: '2023-02-01',
      workerRegistration: 'M-001',
      categoryCode: '101',
      cboCode: '252105',
      monthlySalary: '3000.00',
    });

    expect(xml).toContain('<evtAdmissao Id="ID11234567800019020260714123456ADM01">');
    expect(xml).toContain('<cpfTrab>12345678909</cpfTrab>');
    expect(xml).toContain('<nmTrab>Ana Silva</nmTrab>');
    expect(xml).toContain('<dtNascto>1990-05-20</dtNascto>');
    expect(xml).toContain('<dtAdm>2023-02-01</dtAdm>');
    expect(xml).toContain('<vrSalFx>3000.00</vrSalFx>');
    expect(xml).toContain('<codCargo>252105</codCargo>');
    expect(xml).toContain('matricula="M-001"');
  });

  it('monta S-2299 (desligamento) com motivo, data e verbas', () => {
    const xml = buildS2299Xml({
      eventId: 'ID11234567800019020260714123456DES01',
      environment: 'PRODUCTION_RESTRICTED',
      periodRef: '2026-06',
      employerRegistration: '12.345.678/0001-90',
      workerCpf: '123.456.789-09',
      workerRegistration: 'M-001',
      terminationDate: '2026-06-20',
      motiveCode: terminationMotiveCode('DISPENSA_SEM_JUSTA_CAUSA'),
      paymentId: 'RESC-2026-06',
      items: [
        { code: '1000', reference: null, amount: '2000.00' },
        { code: '1031', reference: null, amount: '1750.00' },
        { code: '5501', reference: null, amount: '0.00' }, // zerado é filtrado
      ],
    });

    expect(xml).toContain('<evtDeslig Id="ID11234567800019020260714123456DES01">');
    expect(xml).toContain('<mtvDeslig>02</mtvDeslig>');
    expect(xml).toContain('<dtDeslig>2026-06-20</dtDeslig>');
    expect(xml).toContain('<vrRubr>2000.00</vrRubr>');
    expect(xml).toContain('<vrRubr>1750.00</vrRubr>');
    // rubrica zerada não entra
    expect(xml).not.toContain('<vrRubr>0.00</vrRubr>');
  });

  it('monta S-1210 (pagamentos) com data, líquido e IRRF', () => {
    const xml = buildS1210Xml({
      eventId: 'ID11234567800019020260714123456PGT01',
      environment: 'PRODUCTION_RESTRICTED',
      periodRef: '2026-07',
      employerRegistration: '12.345.678/0001-90',
      workerCpf: '123.456.789-09',
      paymentDate: '2026-08-05',
      paymentId: 'DM-2026-07',
      netPaid: '2913.98',
      irrf: '23.83',
    });
    expect(xml).toContain('<evtPgtos Id="ID11234567800019020260714123456PGT01">');
    expect(xml).toContain('<cpfBenef>12345678909</cpfBenef>');
    expect(xml).toContain('<dtPgto>2026-08-05</dtPgto>');
    expect(xml).toContain('<perRef>2026-07</perRef>');
    expect(xml).toContain('<vrLiq>2913.98</vrLiq>');
    expect(xml).toContain('<vrIRRF>23.83</vrIRRF>');
  });

  it('S-1210 sem IRRF omite o bloco de detalhamento', () => {
    const xml = buildS1210Xml({
      eventId: 'ID1', environment: 'PRODUCTION_RESTRICTED', periodRef: '2026-07',
      employerRegistration: '12345678000190', workerCpf: '12345678909',
      paymentDate: '2026-08-05', paymentId: 'DM', netPaid: '1500.00', irrf: '0.00',
    });
    expect(xml).not.toContain('<detIR>');
    expect(xml).toContain('<vrLiq>1500.00</vrLiq>');
  });

  it('monta envelope de lote com eventos assinados e SOAP de envio', () => {
    const signedEvent = '<?xml version="1.0" encoding="UTF-8"?>\n<eSocial><evtRemun Id="ID-A"><x/></evtRemun><Signature>abc</Signature></eSocial>';
    const lote = buildLoteEnvelopeXml({
      employerRegistration: '12.345.678/0001-90',
      signedEvents: [{ eventId: 'ID-A', signedXml: signedEvent }],
    });
    expect(lote).toContain('lote/eventos/envio');
    expect(lote).toContain('<envioLoteEventos grupo="1">');
    expect(lote).toContain('<nrInsc>12345678</nrInsc>'); // raiz do CNPJ no empregador
    expect(lote).toContain('<evento Id="ID-A">');
    // o evento embutido perde o próprio prólogo <?xml?>
    expect(lote).not.toContain('<?xml version="1.0" encoding="UTF-8"?>\n<eSocial><evtRemun');
    expect(lote).toContain('<Signature>abc</Signature>');

    const soap = buildSoapEnvelope(lote, 'enviar');
    expect(soap).toContain('soap12:Envelope');
    expect(soap).toContain('<EnviarLoteEventos');
    expect(soap).toContain('<loteEventos>');
  });

  it('extrai protocolo da resposta de envio', () => {
    expect(extractProtocol('<retorno><dadosRecepcaoLote><protocoloEnvio>1.2.202607.0000001</protocoloEnvio></dadosRecepcaoLote></retorno>')).toBe('1.2.202607.0000001');
    expect(extractProtocol('<x:nrProtocolo>ABC123</x:nrProtocolo>')).toBe('ABC123');
    expect(extractProtocol('<sem/>')).toBeNull();
  });
});
