// Lógica pura (testável) de resolução de escopo de áreas.
// Ordem de prioridade do spec:
//   (1) DENY (exceção do usuário) > (2) ALLOW (exceção do usuário)
//   > (3) regra de perfil > (4) regra da área (matriz) > (5) padrão (própria área)
// Conflito ⇒ regra mais restritiva, salvo autorização explícita (exceção ALLOW).

export type AreaAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';
export type AreaScope = string[] | 'ALL';

export type VisibilityLevelName =
  | 'NONE' | 'SUMMARY' | 'FULL' | 'CREATE' | 'EDIT' | 'APPROVE' | 'DELETE' | 'ADMIN';

export interface RuleLite {
  sourceAreaId: string;
  targetAreaId: string;
  moduleKey: string; // específico ou "*"
  visibilityLevel: VisibilityLevelName;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
}

export interface ExceptionLite {
  targetAreaId: string;
  moduleKey: string; // específico ou "*"
  effect: 'ALLOW' | 'DENY';
}

export interface ResolveInput {
  role: string;
  companyWide: boolean; // SUPER_ADMIN / COMPANY_ADMIN
  areaAccessEnabled: boolean; // flag da empresa
  ownAreaIds: string[]; // área principal + atribuições ativas
  moduleKey: string;
  action: AreaAction;
  rules: RuleLite[]; // regras cujo sourceAreaId ∈ ownAreaIds (já filtradas por empresa)
  exceptions: ExceptionLite[]; // exceções ativas do usuário (validade já filtrada)
}

function moduleMatches(ruleModule: string, moduleKey: string): boolean {
  return ruleModule === moduleKey || ruleModule === '*';
}

export function ruleGrants(rule: RuleLite, action: AreaAction): boolean {
  switch (action) {
    case 'view':
      return rule.canView || rule.visibilityLevel !== 'NONE';
    case 'create':
      return rule.canCreate;
    case 'edit':
      return rule.canEdit;
    case 'delete':
      return rule.canDelete;
    case 'approve':
      return rule.canApprove;
    case 'export':
      return rule.canExport || rule.canView;
  }
}

/** Resolve as áreas permitidas para (módulo, ação). 'ALL' = sem restrição de área. */
export function resolveAreaScope(input: ResolveInput): AreaScope {
  // Admins de empresa/plataforma e empresas com flag desligada: sem restrição.
  if (input.companyWide || !input.areaAccessEnabled) return 'ALL';
  // Diretor enxerga toda a empresa em leitura/exportação (mas não escreve fora da área).
  if (input.role === 'DIRECTOR' && (input.action === 'view' || input.action === 'export')) return 'ALL';

  const allowed = new Set<string>(input.ownAreaIds); // (5) própria área sempre permitida
  const denied = new Set<string>();

  // (4) matriz: origem (própria área) → destino, quando a regra concede a ação
  for (const r of input.rules) {
    if (!moduleMatches(r.moduleKey, input.moduleKey)) continue;
    if (ruleGrants(r, input.action)) allowed.add(r.targetAreaId);
  }

  // (2)/(1) exceções do usuário têm prioridade; DENY vence ALLOW
  for (const e of input.exceptions) {
    if (!moduleMatches(e.moduleKey, input.moduleKey)) continue;
    if (e.effect === 'ALLOW') allowed.add(e.targetAreaId);
    else denied.add(e.targetAreaId);
  }
  for (const d of denied) allowed.delete(d);

  return Array.from(allowed);
}

/** Nível de visibilidade efetivo do usuário sobre uma área de destino (para projeção resumida). */
export function levelForArea(input: Omit<ResolveInput, 'action'>, targetAreaId: string): VisibilityLevelName {
  if (input.companyWide || !input.areaAccessEnabled) return 'FULL';
  if (input.ownAreaIds.includes(targetAreaId)) return 'FULL';
  if (input.role === 'DIRECTOR') return 'FULL';

  // DENY explícito zera o acesso
  const denied = input.exceptions.some(
    (e) => e.effect === 'DENY' && moduleMatches(e.moduleKey, input.moduleKey) && e.targetAreaId === targetAreaId,
  );
  if (denied) return 'NONE';
  const allowedExc = input.exceptions.some(
    (e) => e.effect === 'ALLOW' && moduleMatches(e.moduleKey, input.moduleKey) && e.targetAreaId === targetAreaId,
  );
  if (allowedExc) return 'FULL';

  let best: VisibilityLevelName = 'NONE';
  const order: VisibilityLevelName[] = ['NONE', 'SUMMARY', 'FULL', 'CREATE', 'EDIT', 'APPROVE', 'DELETE', 'ADMIN'];
  for (const r of input.rules) {
    if (!moduleMatches(r.moduleKey, input.moduleKey)) continue;
    if (r.targetAreaId !== targetAreaId) continue;
    if (order.indexOf(r.visibilityLevel) > order.indexOf(best)) best = r.visibilityLevel;
  }
  return best;
}
