import { describe, expect, it } from 'vitest';
import { compareProcessActivities, raciConsistency, raciSchema, sipocSchema, artifactSaveSchema } from './process-governance';

const id = 'c77a3de8-8fd6-480e-a507-f42eddbf2d31';
const other = 'b77a3de8-8fd6-480e-a507-f42eddbf2d32';
describe('contratos de governança de processos', () => {
  it('normaliza SIPOC antigo sem perder nomes e rejeita campos inesperados', () => {
    const sipoc = sipocSchema.parse({ suppliers: [{ id, name: ' Cliente ', type: 'EXTERNAL' }] });
    expect(sipoc.suppliers[0]).toMatchObject({ name: 'Cliente', participation: '', needs: '' });
    expect(sipoc.inputs).toEqual([]);
    expect(sipocSchema.safeParse({ companyId: other }).success).toBe(false);
  });
  it('rejeita nomes vazios, referências inválidas e listas excessivas no SIPOC', () => {
    expect(sipocSchema.safeParse({ steps: [{ id, name: '' }] }).success).toBe(false);
    expect(sipocSchema.safeParse({ outputs: [{ id, name: 'Entrega', indicatorIds: ['outra-empresa'] }] }).success).toBe(false);
    expect(sipocSchema.safeParse({ steps: Array.from({ length: 101 }, () => ({ id, name: 'Etapa' })) }).success).toBe(false);
  });
  it('permite R e A para a mesma pessoa e múltiplos executores', () => {
    const content = raciSchema.parse({ rows: [{ id, name: 'Implantar', assignments: [{ subjectType: 'USER', subjectId: id, roles: ['R', 'A'] }, { subjectType: 'AREA', subjectId: other, roles: ['R'] }] }] });
    expect(raciConsistency(content).errors).toEqual([]);
  });
  it('bloqueia aprovação quando não há A ou R e identifica múltiplos A', () => {
    const noRoles = raciConsistency({ rows: [{ id, name: 'Testar', assignments: [] }] });
    expect(noRoles.errors).toHaveLength(2);
    const multiple = raciConsistency({ rows: [{ id, name: 'Testar', assignments: [{ subjectType: 'USER', subjectId: id, roles: ['R', 'A'] }, { subjectType: 'USER', subjectId: other, roles: ['A'] }] }] });
    expect(multiple.errors).toEqual(['Testar: defina exatamente um responsável final (A).']);
  });
  it('detecta participantes e linhas repetidas, e alerta C+I', () => {
    const row = { id, name: 'Analisar', assignments: [{ subjectType: 'USER' as const, subjectId: id, roles: ['R', 'A', 'C', 'I'] as Array<'R' | 'A' | 'C' | 'I'> }] };
    const result = raciConsistency({ rows: [row, { ...row, assignments: [...row.assignments, row.assignments[0]] }] });
    expect(result.errors.some((issue) => issue.includes('participante repetido'))).toBe(true);
    expect(result.errors.some((issue) => issue.includes('Atividade repetida'))).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it('exige alvo completo para uma linha vinculada e revisão para salvar', () => {
    expect(raciSchema.safeParse({ rows: [{ id, name: 'Analisar', targetType: 'ACTIVITY', assignments: [] }] }).success).toBe(false);
    expect(artifactSaveSchema.safeParse({ changeNote: 'Revisão' }).success).toBe(false);
  });
  it('compara AS-IS e TO-BE por identidade sem sinalizar mero reposicionamento', () => {
    const first = [{ elementId: 'A', id: id, artifactId: id, name: 'Requisitos', raciRows: [{ id: other }] }, { elementId: 'B', name: 'Manual' }];
    const next = [{ elementId: 'A', id: other, artifactId: other, name: 'Requisitos' }, { elementId: 'C', name: 'Automático' }];
    expect(compareProcessActivities(first, next)).toEqual({ added: [next[1]], removed: [first[1]], modified: [] });
    expect(compareProcessActivities(first, [{ ...next[0], name: 'Automatizar requisitos' }]).modified).toHaveLength(1);
  });
});
