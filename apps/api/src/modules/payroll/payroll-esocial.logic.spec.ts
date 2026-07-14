import { describe, expect, it } from 'vitest';
import {
  buildEventId,
  buildInternalBatchXml,
  buildS1200Xml,
  decimalStringToEsocialMoney,
  environmentCode,
  hashXml,
  sanitizeEsocialCode,
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
});
