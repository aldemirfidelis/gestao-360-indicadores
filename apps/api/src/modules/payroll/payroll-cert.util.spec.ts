import { describe, expect, it } from 'vitest';
import * as forge from 'node-forge';
import { parsePkcs12, signEsocialXml } from './payroll-cert.util';

/** Gera um .pfx (base64) autoassinado para exercitar o parse e a assinatura. */
function makeSelfSignedPfx(password: string): string {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '0A1B2C';
  cert.validity.notBefore = new Date('2025-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: 'EMPRESA DEMONSTRACAO LTDA:12345678000190' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' });
  return forge.util.encode64(forge.asn1.toDer(p12Asn1).getBytes());
}

const SAMPLE_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtRemun/v_S_01_03_00">',
  '  <evtRemun Id="ID11234567800019020260714123456ABCDE">',
  '    <ideEvento><perApur>2026-07</perApur></ideEvento>',
  '  </evtRemun>',
  '</eSocial>',
].join('\n');

describe('payroll-cert.util', () => {
  it('parsePkcs12 extrai chave, certificado e metadados', () => {
    const pfx = makeSelfSignedPfx('senha123');
    const parsed = parsePkcs12(pfx, 'senha123');
    expect(parsed.privateKeyPem).toContain('PRIVATE KEY');
    expect(parsed.certPem).toContain('BEGIN CERTIFICATE');
    expect(parsed.subjectName).toContain('12345678000190');
    expect(parsed.validUntil?.toISOString().slice(0, 10)).toBe('2027-01-01');
  });

  it('parsePkcs12 falha com senha incorreta', () => {
    const pfx = makeSelfSignedPfx('senha123');
    expect(() => parsePkcs12(pfx, 'errada')).toThrow(/senha|PFX/i);
  });

  it('signEsocialXml gera assinatura enveloped SHA-256/RSA com X509 e Reference ao Id', () => {
    const pfx = makeSelfSignedPfx('senha123');
    const parsed = parsePkcs12(pfx, 'senha123');
    const signed = signEsocialXml(SAMPLE_XML, parsed.privateKeyPem, parsed.certPem);

    expect(signed).toContain('<Signature');
    expect(signed).toContain('xmlenc#sha256');
    expect(signed).toContain('xmldsig-more#rsa-sha256');
    expect(signed).toContain('xml-exc-c14n#');
    expect(signed).toContain('<X509Certificate>');
    // Referência ao Id do evento (assinatura enveloped).
    expect(signed).toContain('URI="#ID11234567800019020260714123456ABCDE"');
    // O evento original continua presente.
    expect(signed).toContain('<perApur>2026-07</perApur>');
  });
});
