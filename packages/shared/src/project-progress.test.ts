import { describe, expect, it } from 'vitest';
import { buildProjectCurve, projectExpectedProgress, projectMeasurementDay, projectProgress } from './project-progress';

const now = new Date('2026-01-11T15:00:00Z');
const project = {
  startsAt: '2026-01-01', endsAt: '2026-01-21',
  tasks: [
    { startDate: '2026-01-01', endDate: '2026-01-11', progress: 20 },
    { startDate: '2026-01-11', endDate: '2026-01-21', progress: 40 },
  ],
  milestones: [{ dueDate: '2026-01-11', done: true }, { dueDate: '2026-01-21', done: false }],
};

describe('avanço e curva S de projetos', () => {
  it('preserva a média entre tarefas e marcos do PMO', () => {
    expect(projectProgress(project)).toBe(40);
    expect(projectProgress({ milestones: [], tasks: project.tasks })).toBe(30);
    expect(projectProgress({ milestones: project.milestones })).toBe(50);
    expect(projectProgress({ milestones: [] })).toBe(0);
  });
  it('planeja pelos períodos das tarefas e vencimentos dos marcos', () => {
    expect(projectExpectedProgress(project, now)).toBe(50);
    expect(projectExpectedProgress(project, new Date('2025-12-30T15:00:00Z'))).toBe(0);
    expect(projectExpectedProgress(project, new Date('2026-02-01T15:00:00Z'))).toBe(100);
  });
  it('usa as datas do projeto quando uma tarefa não tem datas próprias', () => {
    expect(projectExpectedProgress({ ...project, tasks: [{ progress: 25 }], milestones: [] }, now)).toBe(50);
    expect(projectExpectedProgress({ ...project, tasks: [], milestones: [] }, now)).toBe(50);
  });
  it('não inventa planejamento para cronogramas incompletos ou invertidos', () => {
    expect(projectExpectedProgress({ milestones: [], tasks: [{ progress: 20 }] }, now)).toBeNull();
    expect(projectExpectedProgress({ milestones: [], startsAt: '2026-01-20', endsAt: '2026-01-01' }, now)).toBeNull();
    expect(projectExpectedProgress({ milestones: [], startsAt: 'inválida', endsAt: '2026-01-01' }, now)).toBeNull();
  });
  it('aceita tarefas e projetos com duração de um dia', () => {
    expect(projectExpectedProgress({ milestones: [], startsAt: '2026-01-11', endsAt: '2026-01-11' }, now)).toBe(100);
  });
  it('mantém medições reais e não projeta realizado para o futuro', () => {
    const curve = buildProjectCurve({ ...project, progressSnapshots: [
      { measuredOn: '2026-01-05', progress: 10 },
      { measuredOn: '2026-01-08', progress: 30 },
    ] }, now);
    expect(curve.historyStartsOn).toBe('2026-01-05T00:00:00.000Z');
    expect(curve.points.find((point) => point.date.startsWith('2026-01-01'))?.actual).toBeNull();
    expect(curve.points.find((point) => point.date.startsWith('2026-01-06'))?.actual).toBe(10);
    expect(curve.points.find((point) => point.date.startsWith('2026-01-09'))?.actual).toBe(30);
    expect(curve.points.find((point) => point.date.startsWith('2026-01-11'))).toMatchObject({ actual: 40, planned: 50 });
    expect(curve.points.filter((point) => point.date > curve.measuredOn).every((point) => point.actual === null)).toBe(true);
  });
  it('sem histórico mostra apenas a medição atual, inclusive antes do início previsto', () => {
    const curve = buildProjectCurve(project, new Date('2025-12-20T15:00:00Z'));
    expect(curve.historyStartsOn).toBeNull();
    expect(curve.points.filter((point) => point.actual !== null)).toEqual([
      { date: '2025-12-20T00:00:00.000Z', actual: 40, planned: 0 },
    ]);
  });
  it('troca de dia à meia-noite de São Paulo', () => {
    expect(projectMeasurementDay(new Date('2026-01-12T02:59:59Z')).toISOString()).toBe('2026-01-11T00:00:00.000Z');
    expect(projectMeasurementDay(new Date('2026-01-12T03:00:00Z')).toISOString()).toBe('2026-01-12T00:00:00.000Z');
  });
  it('replanejar não altera o histórico do realizado', () => {
    const input = { ...project, progressSnapshots: [{ measuredOn: '2026-01-05', progress: 10 }] };
    const before = buildProjectCurve(input, now);
    const after = buildProjectCurve({ ...input, tasks: input.tasks.map((task) => ({ ...task, endDate: '2026-02-01' })) }, now);
    expect(after.points.find((point) => point.date.startsWith('2026-01-05'))?.actual).toBe(10);
    expect(after.points.find((point) => point.date === after.measuredOn)?.planned).not.toBe(before.points.find((point) => point.date === before.measuredOn)?.planned);
  });
  it('limita a amostragem em projetos longos e tolera valores legados fora da faixa', () => {
    const curve = buildProjectCurve({ startsAt: '2000-01-01', endsAt: '2100-01-01', milestones: [], tasks: [{ progress: 200 }] }, now);
    expect(curve.points.length).toBeLessThan(110);
    expect(projectProgress({ milestones: [], tasks: [{ progress: 200 }, { progress: -100 }] })).toBe(50);
  });
});
