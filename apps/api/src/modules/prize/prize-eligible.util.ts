/**
 * Utilitarios puros da base elegivel (Fase 3) — sem banco, testaveis.
 * LGPD: CPF e sempre mascarado antes de persistir/exibir.
 */

export interface EligibleRow {
  registration: string;
  name: string;
  cpf?: string | null; // CPF cru (somente para mascarar; NUNCA persistido em claro)
  bond?: string | null;
  branchRef?: string | null;
  unitRef?: string | null;
  positionRef?: string | null;
  functionRef?: string | null;
  areaRef?: string | null;
  sectorRef?: string | null;
  costCenterRef?: string | null;
  baseSalary?: number | null;
  admissionDate?: string | null;
  terminationDate?: string | null;
  situation?: string | null;
  workedDays?: number | null;
}

/** Mascara CPF preservando apenas os digitos do meio: 123.456.789-00 -> ***.456.789-**. */
export function maskCpf(cpf?: string | null): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export interface SnapshotLike {
  registration: string;
  positionRef?: string | null;
  areaRef?: string | null;
  costCenterRef?: string | null;
  situation?: string | null;
  baseSalary?: number | null;
}

export interface ReconcileChange {
  registration: string;
  field: string;
  from: unknown;
  to: unknown;
}
export interface ReconcileResult {
  added: string[]; // matriculas novas no lote entrante
  removed: string[]; // matriculas que sairam (estavam no anterior, nao no novo)
  changed: ReconcileChange[]; // campos relevantes que mudaram
  unchanged: number;
  flags: {
    missingSalary: string[];
    missingPosition: string[];
    terminated: string[];
  };
}

const COMPARE_FIELDS: Array<keyof SnapshotLike> = ['positionRef', 'areaRef', 'costCenterRef', 'situation', 'baseSalary'];

/**
 * Concilia o lote entrante contra o snapshot atual (anterior). Identifica
 * inclusoes, exclusoes, alteracoes relevantes e sinaliza pendencias.
 */
export function reconcile(previous: SnapshotLike[], incoming: SnapshotLike[]): ReconcileResult {
  const prevByReg = new Map(previous.map((p) => [p.registration, p]));
  const incByReg = new Map(incoming.map((i) => [i.registration, i]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: ReconcileChange[] = [];
  let unchanged = 0;

  const missingSalary: string[] = [];
  const missingPosition: string[] = [];
  const terminated: string[] = [];

  for (const inc of incoming) {
    if (inc.baseSalary === null || inc.baseSalary === undefined) missingSalary.push(inc.registration);
    if (!inc.positionRef) missingPosition.push(inc.registration);
    if (inc.situation && inc.situation.toUpperCase().startsWith('TERMIN')) terminated.push(inc.registration);

    const prev = prevByReg.get(inc.registration);
    if (!prev) {
      added.push(inc.registration);
      continue;
    }
    let rowChanged = false;
    for (const f of COMPARE_FIELDS) {
      const a = prev[f] ?? null;
      const b = inc[f] ?? null;
      if (String(a) !== String(b)) {
        changed.push({ registration: inc.registration, field: f as string, from: a, to: b });
        rowChanged = true;
      }
    }
    if (!rowChanged) unchanged++;
  }

  for (const prev of previous) {
    if (!incByReg.has(prev.registration)) removed.push(prev.registration);
  }

  return { added, removed, changed, unchanged, flags: { missingSalary, missingPosition, terminated } };
}

// ---- Gerador de base ficticia para homologacao (NAO usa dados reais) ----
const FAKE_FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Fabio', 'Gabriela', 'Heitor', 'Iara', 'Joao'];
const FAKE_LAST = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Costa', 'Pereira', 'Almeida'];
const FAKE_POSITIONS = ['Operador I', 'Operador II', 'Tecnico', 'Analista', 'Supervisor', 'Encarregado'];
const FAKE_AREAS = ['Producao', 'Manutencao', 'Qualidade', 'Logistica', 'Industrial'];
const FAKE_CC = ['CC-100', 'CC-200', 'CC-300', 'CC-400'];

/** Base ficticia deterministica (seed) para homologacao. */
export function generateMockEligible(count = 12, seed = 1): EligibleRow[] {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const rows: EligibleRow[] = [];
  for (let i = 0; i < count; i++) {
    const reg = String(1000 + i);
    const cpfDigits = String(10000000000 + Math.floor(rnd() * 89999999999));
    rows.push({
      registration: reg,
      name: `${pick(FAKE_FIRST)} ${pick(FAKE_LAST)}`,
      cpf: cpfDigits,
      bond: 'CLT',
      positionRef: pick(FAKE_POSITIONS),
      areaRef: pick(FAKE_AREAS),
      costCenterRef: pick(FAKE_CC),
      baseSalary: Math.round((2000 + rnd() * 6000) * 100) / 100,
      situation: rnd() > 0.92 ? 'TERMINATED' : 'ACTIVE',
      workedDays: 30,
      admissionDate: '2022-01-10',
    });
  }
  return rows;
}
