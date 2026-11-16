import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readBpmn, EMPTY_BPMN } from './bpmn';
const fixture = readFileSync(resolve(process.cwd(), '../../tests/fixtures/process-digital-implementation.bpmn'), 'utf8');
describe('importação BPMN 2.0', () => {
  it('lê processo de implantação com pool, lanes, tarefas e decisão', async () => {
    const result = await readBpmn(fixture);
    expect(result.issues).toEqual([]);
    expect(result.activities.map((activity) => activity.elementId)).toEqual(expect.arrayContaining(['Requirements', 'Development', 'Tests', 'Deployment']));
    expect(result.activities).toHaveLength(4);
  });
  it('mantém rascunho inicial e informa a estrutura que falta para publicar', async () => {
    expect((await readBpmn(EMPTY_BPMN)).issues.some((issue) => issue.includes('fim'))).toBe(true);
  });
  it.each(['<!DOCTYPE x><x/>', '<!ENTITY secret SYSTEM "file:///etc/passwd">', '<bpmn:import location="https://example.test/secret"/>'])('rejeita recursos externos: %s', async (xml) => {
    await expect(readBpmn(xml)).rejects.toThrow('Declarações externas');
  });
  it('rejeita XML inválido, referência inexistente e arquivo excessivo', async () => {
    await expect(readBpmn('<bpmn:definitions>')).rejects.toThrow();
    await expect(readBpmn(fixture.replace('targetRef="Requirements"', 'targetRef="Missing"'))).rejects.toThrow('inválidos');
    await expect(readBpmn('x'.repeat(2_000_001))).rejects.toThrow('2 MB');
  });
});
