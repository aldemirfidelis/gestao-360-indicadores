type DateValue = Date | string | null | undefined;

export interface ProjectProgressInput {
  startsAt?: DateValue;
  endsAt?: DateValue;
  tasks?: Array<{ progress: number; startDate?: DateValue; endDate?: DateValue }>;
  milestones: Array<{ done: boolean; dueDate?: DateValue }>;
  progressSnapshots?: Array<{ measuredOn: DateValue; progress: number }>;
}

const DAY = 86_400_000;
const clamp = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

function day(value: DateValue): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Uma medição por dia no fuso da plataforma (São Paulo). */
export function projectMeasurementDay(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

/** Mantém o critério já usado pelo PMO: tarefas e marcos têm pesos iguais. */
export function projectProgress(project: ProjectProgressInput): number {
  const tasks = project.tasks ?? [];
  const taskProgress = tasks.length ? tasks.reduce((sum, task) => sum + clamp(task.progress), 0) / tasks.length : null;
  const milestoneProgress = project.milestones.length
    ? project.milestones.filter((milestone) => milestone.done).length / project.milestones.length * 100 : null;
  if (taskProgress !== null && milestoneProgress !== null) return Math.round((taskProgress + milestoneProgress) / 2);
  return Math.round(taskProgress ?? milestoneProgress ?? 0);
}

function plannedAt(project: ProjectProgressInput, time: number): number | null {
  const linear = (startValue: DateValue, endValue: DateValue) => {
    const start = day(startValue);
    const end = day(endValue);
    if (start === null || end === null || end < start) return null;
    if (start === end) return time >= end ? 100 : 0;
    return clamp((time - start) / (end - start) * 100);
  };
  const tasks = project.tasks ?? [];
  const groups: number[] = [];
  if (tasks.length) {
    const values = tasks.map((task) => linear(task.startDate ?? project.startsAt, task.endDate ?? project.endsAt));
    if (values.some((value) => value === null)) return null;
    groups.push(values.reduce<number>((sum, value) => sum + (value ?? 0), 0) / tasks.length);
  }
  if (project.milestones.length) {
    const dates = project.milestones.map((milestone) => day(milestone.dueDate));
    if (dates.some((date) => date === null)) return null;
    groups.push(dates.filter((date) => date !== null && date <= time).length / dates.length * 100);
  }
  if (!groups.length) return linear(project.startsAt, project.endsAt);
  return groups.reduce((sum, value) => sum + value, 0) / groups.length;
}

export function projectExpectedProgress(project: ProjectProgressInput, now = new Date()): number | null {
  const planned = plannedAt(project, projectMeasurementDay(now).getTime());
  return planned === null ? null : Math.round(planned);
}

/** O realizado só existe a partir da primeira medição; nunca é reconstruído pelos prazos. */
export function buildProjectCurve(project: ProjectProgressInput, now = new Date()) {
  const today = projectMeasurementDay(now).getTime();
  const snapshots = (project.progressSnapshots ?? [])
    .map((snapshot) => ({ time: day(snapshot.measuredOn), progress: clamp(snapshot.progress) }))
    .filter((snapshot): snapshot is { time: number; progress: number } => snapshot.time !== null && snapshot.time <= today)
    .sort((a, b) => a.time - b.time);
  const dates = [today];
  const addDate = (value: DateValue) => { const time = day(value); if (time !== null) dates.push(time); };
  addDate(project.startsAt);
  addDate(project.endsAt);
  for (const task of project.tasks ?? []) { addDate(task.startDate); addDate(task.endDate); }
  for (const milestone of project.milestones) {
    const due = day(milestone.dueDate);
    if (due !== null) dates.push(due - DAY, due);
  }
  for (const snapshot of snapshots) dates.push(snapshot.time);
  const first = Math.min(...dates);
  const last = Math.max(...dates);
  const stamps = new Set(dates);
  const step = Math.max(1, Math.ceil((last - first) / DAY / 100)) * DAY;
  for (let time = first; time <= last; time += step) stamps.add(time);
  const progress = projectProgress(project);
  let snapshotIndex = -1;
  const points = [...stamps].sort((a, b) => a - b).map((time) => {
    while (snapshotIndex + 1 < snapshots.length && snapshots[snapshotIndex + 1].time <= time) snapshotIndex++;
    const planned = plannedAt(project, time);
    return {
      date: new Date(time).toISOString(),
      planned: planned === null ? null : Math.round(planned),
      actual: time > today ? null : time === today ? progress : snapshotIndex < 0 ? null : snapshots[snapshotIndex].progress,
    };
  });
  return {
    points,
    historyStartsOn: snapshots.length ? new Date(snapshots[0].time).toISOString() : null,
    measuredOn: new Date(today).toISOString(),
    hasSchedule: projectExpectedProgress(project, now) !== null,
  };
}

export type ProjectCurve = ReturnType<typeof buildProjectCurve>;

export interface PortfolioCurveProject extends ProjectProgressInput {
  status?: string | null;
}

/**
 * Curva S de um portfólio: média simples dos projetos com cronograma (cancelados ficam fora).
 * O realizado de cada projeto vale zero enquanto nada estava planejado; depois disso só existe
 * a partir da primeira medição. O realizado do portfólio aparece apenas nos dias em que todos
 * os projetos da curva têm valor, para nunca misturar conjuntos diferentes de projetos.
 */
export function buildPortfolioCurve(projects: PortfolioCurveProject[], now = new Date()) {
  const today = projectMeasurementDay(now).getTime();
  const candidates = projects.filter((project) => project.status !== 'CANCELLED');
  const series = candidates
    .filter((project) => plannedAt(project, today) !== null)
    .map((project) => ({
      project,
      progress: projectProgress(project),
      snapshots: (project.progressSnapshots ?? [])
        .map((snapshot) => ({ time: day(snapshot.measuredOn), progress: clamp(snapshot.progress) }))
        .filter((snapshot): snapshot is { time: number; progress: number } => snapshot.time !== null && snapshot.time <= today)
        .sort((a, b) => a.time - b.time),
    }));

  const dates = [today];
  for (const { project, snapshots } of series) {
    const addDate = (value: DateValue) => { const time = day(value); if (time !== null) dates.push(time); };
    addDate(project.startsAt);
    addDate(project.endsAt);
    for (const task of project.tasks ?? []) { addDate(task.startDate); addDate(task.endDate); }
    for (const milestone of project.milestones) addDate(milestone.dueDate);
    if (snapshots.length) dates.push(snapshots[0].time);
  }
  const first = Math.min(...dates);
  const last = Math.max(...dates);
  const step = Math.max(1, Math.ceil((last - first) / DAY / 150)) * DAY;
  const stamps = new Set([first, last, today]);
  for (let time = first; time <= last; time += step) stamps.add(time);

  const actualAt = (entry: (typeof series)[number], time: number): number | null => {
    if (time > today) return null;
    if (time === today) return entry.progress;
    let value: number | null = null;
    for (const snapshot of entry.snapshots) {
      if (snapshot.time > time) break;
      value = snapshot.progress;
    }
    if (value !== null) return value;
    return plannedAt(entry.project, time) === 0 ? 0 : null;
  };
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

  const points = [...stamps].sort((a, b) => a - b).map((time) => {
    if (!series.length) return { date: new Date(time).toISOString(), planned: null, actual: null };
    const actuals = series.map((entry) => actualAt(entry, time));
    return {
      date: new Date(time).toISOString(),
      planned: Math.round(mean(series.map((entry) => plannedAt(entry.project, time) ?? 0))),
      actual: actuals.every((value) => value !== null) ? Math.round(mean(actuals as number[])) : null,
    };
  });
  const firstMeasurements = series.flatMap((entry) => (entry.snapshots.length ? [entry.snapshots[0].time] : []));
  return {
    points,
    historyStartsOn: firstMeasurements.length ? new Date(Math.min(...firstMeasurements)).toISOString() : null,
    measuredOn: new Date(today).toISOString(),
    hasSchedule: series.length > 0,
    /** Projetos considerados na curva (com cronograma e não cancelados). */
    projects: series.length,
    /** Projetos fora da curva por falta de cronograma. */
    withoutSchedule: candidates.length - series.length,
    progress: series.length ? Math.round(mean(series.map((entry) => entry.progress))) : null,
    expectedProgress: series.length ? Math.round(mean(series.map((entry) => plannedAt(entry.project, today) ?? 0))) : null,
  };
}

export type PortfolioCurve = ReturnType<typeof buildPortfolioCurve>;
