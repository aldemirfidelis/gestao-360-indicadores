import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateEsocialXsd, xsdConfigured } from './payroll-xsd.util';

const SIMPLE_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="evtRemun">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="perApur" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

describe('payroll-xsd.util', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'esocial-xsd-'));
    await writeFile(join(dir, 'S-1200.xsd'), SIMPLE_XSD, 'utf8');
  });
  afterAll(async () => {
    delete process.env.PAYROLL_ESOCIAL_XSD_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('pula a validação quando a pasta de XSD não está configurada', async () => {
    delete process.env.PAYROLL_ESOCIAL_XSD_DIR;
    expect(xsdConfigured()).toBe(false);
    const result = await validateEsocialXsd('<evtRemun><perApur>2026-07</perApur></evtRemun>', 'S-1200');
    expect(result.validated).toBe(false);
    expect(result.valid).toBe(true);
  });

  it('valida um XML correto contra o XSD configurado', async () => {
    process.env.PAYROLL_ESOCIAL_XSD_DIR = dir;
    expect(xsdConfigured()).toBe(true);
    const result = await validateEsocialXsd('<evtRemun><perApur>2026-07</perApur></evtRemun>', 'S-1200');
    expect(result.validated).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('acusa erro quando o XML viola o XSD', async () => {
    process.env.PAYROLL_ESOCIAL_XSD_DIR = dir;
    const result = await validateEsocialXsd('<evtRemun><campoErrado>x</campoErrado></evtRemun>', 'S-1200');
    expect(result.validated).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
