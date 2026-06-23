'use client';

import { useState } from 'react';
import { ChevronRight, Save, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { ANALYSIS_METHOD_LABEL } from '@/lib/labels';
import { IshikawaVisualAnalysis } from '@/components/platform/ishikawa-visual-analysis';
import { PDCAVisualAnalysis } from '@/components/platform/pdca-visual-analysis';
import { FiveWTwoHVisualAnalysis } from '@/components/platform/five-w-two-h-visual-analysis';
import { FiveWhysVisualAnalysis } from '@/components/platform/five-whys-visual-analysis';

const TOOL_LABEL = ANALYSIS_METHOD_LABEL;
const VISIBLE_ANALYSIS_METHODS = ['ISHIKAWA', 'FIVE_WHYS', 'FIVE_W_TWO_H', 'PDCA'] as const;

/**
 * Ferramentas reais de análise de causa (5 Porquês, Ishikawa 6M, MASP, PDCA...).
 * Componente único reutilizado no Plano de Ação e na Reunião — ao trocar o método,
 * a ferramenta correspondente é renderizada e o conteúdo é salvo/linkado no plano.
 */
export interface AnalysisWorkspaceAction {
  id?: string;
  analysisTool: string | null;
  problemDescription: string | null;
  rootCause: string | null;
  analysisSessions: any[];
  // Campos opcionais de contexto (usados pelo auto-pull do PDCA e quando o plano ainda não existe).
  indicator?: any;
  ownerNode?: any;
  responsibleUser?: any;
  deviationId?: string;
}

export interface AnalysisPayload {
  method: string;
  problem: string;
  rootCause: string;
  fiveWhys: any[];
  ishikawaCauses: any[];
  maspSteps: any[];
  pdcaSteps: any[];
  data?: any;
  fiveW2H?: any;
}

export function AnalysisWorkspace({
  action,
  onSave,
  saving,
  onAskAi,
  onEnsureActionPlan,
  users = [],
  canEdit = true,
  title = 'Ferramentas reais de análise',
  description = 'Preencha a ferramenta escolhida, salve a análise e use a IA como facilitadora antes de confirmar.',
}: {
  action: AnalysisWorkspaceAction;
  onSave: (payload: AnalysisPayload) => void;
  saving: boolean;
  onAskAi?: () => void;
  onEnsureActionPlan?: () => Promise<string>;
  users?: { id: string; name: string; email?: string }[];
  canEdit?: boolean;
  title?: string;
  description?: string;
}) {
  const preferredMethod = action.analysisTool ?? action.analysisSessions[0]?.method ?? 'ISHIKAWA';
  const initialMethod = isVisibleAnalysisMethod(preferredMethod) ? preferredMethod : 'ISHIKAWA';
  const session =
    action.analysisSessions.find((item) => item.method === initialMethod) ??
    action.analysisSessions.find((item) => isVisibleAnalysisMethod(item.method));
  const [method, setMethod] = useState<string>(initialMethod);
  const [problem, setProblem] = useState(session?.problem ?? action.problemDescription ?? '');
  const [rootCause, setRootCause] = useState(session?.rootCause ?? action.rootCause ?? '');
  const [fiveWhys, setFiveWhys] = useState<any[]>(session?.fiveWhys?.length ? session.fiveWhys : Array.from({ length: 5 }, (_v, i) => ({ position: i + 1, question: `${i + 1}º por quê?`, answer: '', evidence: '' })));
  const [ishikawa, setIshikawa] = useState<any[]>(session?.ishikawaCauses?.length ? session.ishikawaCauses : []);
  const [maspSteps, setMaspSteps] = useState<any[]>(session?.maspSteps?.length ? session.maspSteps : ['Identificação do problema', 'Observação', 'Análise', 'Plano de ação', 'Execução', 'Verificação', 'Padronização', 'Conclusão'].map((title, i) => ({ step: i + 1, title, description: '', status: 'PENDING' })));
  const [pdcaSteps, setPdcaSteps] = useState<any[]>(session?.pdcaSteps?.length ? session.pdcaSteps : ['PLAN', 'DO', 'CHECK', 'ACT'].map((phase) => ({ phase, description: '', status: 'PENDING' })));
  // Encadeamento: causa provável marcada no Ishikawa "semeia" o 1º porquê do 5 Porquês.
  const [seedWhyAnswer, setSeedWhyAnswer] = useState<string | null>(null);
  const ishikawaSession = action.analysisSessions.find((item) => item.method === 'ISHIKAWA');
  const pdcaSession = action.analysisSessions.find((item) => item.method === 'PDCA');
  const fiveW2HSession = action.analysisSessions.find((item) => item.method === 'FIVE_W_TWO_H');
  const fiveWhysSession = action.analysisSessions.find((item) => item.method === 'FIVE_WHYS');

  return (
    <SectionCard
      title={title}
      description={description}
      actions={onAskAi ? <Button variant="outline" onClick={onAskAi}><Sparkles className="mr-2 h-4 w-4" />Sugerir perguntas</Button> : undefined}
    >
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label>Ferramenta</Label>
          <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
            {VISIBLE_ANALYSIS_METHODS.map((key) => <option key={key} value={key}>{TOOL_LABEL[key] ?? key}</option>)}
          </NativeSelect>
        </div>
        <div className="md:col-span-2">
          <Label>Problema principal</Label>
          <Input value={problem} onChange={(e) => setProblem(e.target.value)} />
        </div>
      </div>

      <AnalysisSequenceHint method={method} onSelect={setMethod} />

      {method === 'FIVE_WHYS' && (
        <FiveWhysVisualAnalysis
          actionId={action.id}
          action={action}
          session={fiveWhysSession}
          problem={problem}
          rootCause={rootCause}
          users={users}
          saving={saving}
          canEdit={canEdit}
          seedAnswer={seedWhyAnswer}
          onSeedConsumed={() => setSeedWhyAnswer(null)}
          onRootCauseChange={setRootCause}
          onSave={(whyItems, nextRootCause = rootCause, extra) => {
            setFiveWhys(whyItems);
            onSave({ method: 'FIVE_WHYS', problem, rootCause: nextRootCause, fiveWhys: deriveLegacyWhys(whyItems), ishikawaCauses: ishikawa, maspSteps, pdcaSteps, data: { items: whyItems, ...(extra ?? {}) } });
          }}
        />
      )}

      {method === 'ISHIKAWA' && (
        <IshikawaVisualAnalysis
          actionId={action.id}
          session={ishikawaSession}
          problem={problem}
          rootCause={rootCause}
          users={users}
          saving={saving}
          canEdit={canEdit}
          onRootCauseChange={setRootCause}
          onSendToFiveWhys={(causeText) => {
            const text = String(causeText ?? '').trim();
            if (!text) return;
            setSeedWhyAnswer(text);
            setMethod('FIVE_WHYS');
          }}
          onSave={(causes, nextRootCause = rootCause) => {
            setIshikawa(causes);
            onSave({ method: 'ISHIKAWA', problem, rootCause: nextRootCause, fiveWhys, ishikawaCauses: causes, maspSteps, pdcaSteps });
          }}
        />
      )}

      {method === 'MASP' && <StepEditor rows={maspSteps} setRows={setMaspSteps} labelKey="title" />}
      {method === 'PDCA' && (
        <PDCAVisualAnalysis
          actionId={action.id}
          action={action}
          session={pdcaSession}
          stages={pdcaSteps}
          rootCause={rootCause}
          users={users}
          saving={saving}
          canEdit={canEdit}
          onRootCauseChange={setRootCause}
          onSave={(stages, nextRootCause = rootCause) => {
            setPdcaSteps(stages);
            onSave({ method, problem, rootCause: nextRootCause, fiveWhys, ishikawaCauses: ishikawa, maspSteps, pdcaSteps: stages });
          }}
        />
      )}
      {method === 'FIVE_W_TWO_H' && (
        <FiveWTwoHVisualAnalysis
          actionId={action.id}
          action={action}
          session={fiveW2HSession}
          users={users}
          saving={saving}
          canEdit={canEdit}
          onEnsureActionPlan={onEnsureActionPlan}
          onTaskCreated={() => setMethod('PDCA')}
          onSave={(items) => onSave({ method: 'FIVE_W_TWO_H', problem, rootCause, fiveWhys, ishikawaCauses: ishikawa, maspSteps, pdcaSteps, data: { items }, fiveW2H: deriveFiveW2HSummary(items) })}
        />
      )}
      {!isVisibleAnalysisMethod(method) && <GenericAnalysis method={method} session={session} />}

      {!isVisibleAnalysisMethod(method) && (
        <>
          <div className="mt-4">
            <Label>Causa raiz provável</Label>
            <Textarea rows={3} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button disabled={saving || !canEdit} onClick={() => onSave({ method, problem, rootCause, fiveWhys, ishikawaCauses: ishikawa, maspSteps, pdcaSteps })}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar análise'}
            </Button>
          </div>
        </>
      )}
    </SectionCard>
  );
}

/**
 * Faixa-guia da sequência de análise: Ishikawa → 5 Porquês → 5W2H → PDCA.
 * Clicável para navegar; destaca a ferramenta atual.
 */
function AnalysisSequenceHint({ method, onSelect }: { method: string; onSelect: (m: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
      <span className="font-medium text-muted-foreground">Sequência:</span>
      {VISIBLE_ANALYSIS_METHODS.map((key, index) => (
        <span key={key} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 font-medium transition',
              method === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {index + 1}. {TOOL_LABEL[key] ?? key}
          </button>
          {index < VISIBLE_ANALYSIS_METHODS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
        </span>
      ))}
    </div>
  );
}

function StepEditor({ rows, setRows, labelKey }: { rows: any[]; setRows: (rows: any[]) => void; labelKey: string }) {
  return (
    <div className="space-y-3">
      {rows.map((item, index) => (
        <div key={index} className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-semibold">{item[labelKey]}</div>
          <Textarea rows={2} value={item.description ?? ''} onChange={(e) => setRows(updateArray(rows, index, { ...item, description: e.target.value }))} />
        </div>
      ))}
    </div>
  );
}

function GenericAnalysis({ method, session }: { method: string; session?: any }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      Use o campo de causa raiz abaixo para registrar a análise {TOOL_LABEL[method] ?? method}. Dados complementares ficam salvos no JSON da sessão.
      {session?.aiSummary && <div className="mt-2 rounded-md bg-muted p-2">{session.aiSummary}</div>}
    </div>
  );
}

export function updateArray(rows: any[], index: number, value: any) {
  return rows.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function isVisibleAnalysisMethod(method: string | null | undefined): method is typeof VISIBLE_ANALYSIS_METHODS[number] {
  return Boolean(method && VISIBLE_ANALYSIS_METHODS.includes(method as typeof VISIBLE_ANALYSIS_METHODS[number]));
}

/**
 * Resumo textual do 5W2H para manter a tabela simples (ActionFiveW2H) sincronizada.
 * O board completo (7 cards + detalhes) é persistido em session.data.items.
 */
function deriveFiveW2HSummary(items: any[]) {
  const byType = (type: string) => items.find((item) => item.itemType === type);
  const text = (type: string) => {
    const item = byType(type);
    if (!item) return null;
    const description = String(item.description ?? '').trim();
    if (description) return description;
    const bullets = Array.isArray(item.bullets) ? item.bullets.filter(Boolean) : [];
    return bullets.length ? bullets.join('; ') : null;
  };
  const whenItem = byType('WHEN');
  const howMuchItem = byType('HOW_MUCH');
  const rawCost = String(howMuchItem?.data?.cost ?? '').replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const cost = Number(rawCost);
  return {
    what: text('WHAT'),
    why: text('WHY'),
    where: text('WHERE'),
    when: whenItem?.dueDate || whenItem?.data?.endDate || undefined,
    who: text('WHO'),
    how: text('HOW'),
    howMuch: Number.isFinite(cost) && cost > 0 ? cost : undefined,
    reviewNotes: null,
  };
}

/**
 * Converte o board rico dos 5 Porquês (persistido em session.data.items) para as
 * linhas da tabela legada ActionFiveWhy (position/question/answer/evidence/isRootCause).
 */
function deriveLegacyWhys(items: any[]) {
  return items.map((item, index) => {
    const evidences = Array.isArray(item.evidences) ? item.evidences.map((evidence: any) => evidence?.name).filter(Boolean) : [];
    const evidence = String(item.evidence ?? '').trim() || (evidences.length ? evidences.join('; ') : null);
    return {
      position: Number(item.level ?? index + 1),
      question: String(item.question ?? `${index + 1}º por quê?`).trim() || `${index + 1}º por quê?`,
      answer: String(item.answer ?? '').trim() || null,
      evidence,
      isRootCause: Boolean(item.isRootCause),
    };
  });
}
