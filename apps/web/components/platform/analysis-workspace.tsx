'use client';

import { useState } from 'react';
import { Save, Sparkles } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { ANALYSIS_METHOD_LABEL } from '@/lib/labels';

const TOOL_LABEL = ANALYSIS_METHOD_LABEL;

/**
 * Ferramentas reais de análise de causa (5 Porquês, Ishikawa 6M, MASP, PDCA...).
 * Componente único reutilizado no Plano de Ação e na Reunião — ao trocar o método,
 * a ferramenta correspondente é renderizada e o conteúdo é salvo/linkado no plano.
 */
export interface AnalysisWorkspaceAction {
  analysisTool: string | null;
  problemDescription: string | null;
  rootCause: string | null;
  analysisSessions: any[];
}

export interface AnalysisPayload {
  method: string;
  problem: string;
  rootCause: string;
  fiveWhys: any[];
  ishikawaCauses: any[];
  maspSteps: any[];
  pdcaSteps: any[];
}

export function AnalysisWorkspace({
  action,
  onSave,
  saving,
  onAskAi,
  title = 'Ferramentas reais de análise',
  description = 'Preencha a ferramenta escolhida, salve a análise e use a IA como facilitadora antes de confirmar.',
}: {
  action: AnalysisWorkspaceAction;
  onSave: (payload: AnalysisPayload) => void;
  saving: boolean;
  onAskAi?: () => void;
  title?: string;
  description?: string;
}) {
  const session = action.analysisSessions.find((item) => item.method === (action.analysisTool ?? 'FIVE_WHYS')) ?? action.analysisSessions[0];
  const [method, setMethod] = useState(action.analysisTool ?? session?.method ?? 'FIVE_WHYS');
  const [problem, setProblem] = useState(session?.problem ?? action.problemDescription ?? '');
  const [rootCause, setRootCause] = useState(session?.rootCause ?? action.rootCause ?? '');
  const [fiveWhys, setFiveWhys] = useState<any[]>(session?.fiveWhys?.length ? session.fiveWhys : Array.from({ length: 5 }, (_v, i) => ({ position: i + 1, question: `${i + 1}º por quê?`, answer: '', evidence: '' })));
  const [ishikawa, setIshikawa] = useState<any[]>(session?.ishikawaCauses?.length ? session.ishikawaCauses : ['Método', 'Máquina', 'Mão de obra', 'Material', 'Meio ambiente', 'Medição'].map((category) => ({ category, description: '', impact: 3, probability: 3, evidence: '' })));
  const [maspSteps, setMaspSteps] = useState<any[]>(session?.maspSteps?.length ? session.maspSteps : ['Identificação do problema', 'Observação', 'Análise', 'Plano de ação', 'Execução', 'Verificação', 'Padronização', 'Conclusão'].map((title, i) => ({ step: i + 1, title, description: '', status: 'PENDING' })));
  const [pdcaSteps, setPdcaSteps] = useState<any[]>(session?.pdcaSteps?.length ? session.pdcaSteps : ['PLAN', 'DO', 'CHECK', 'ACT'].map((phase) => ({ phase, description: '', status: 'PENDING' })));

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
            {Object.entries(TOOL_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </NativeSelect>
        </div>
        <div className="md:col-span-2">
          <Label>Problema principal</Label>
          <Input value={problem} onChange={(e) => setProblem(e.target.value)} />
        </div>
      </div>

      {method === 'FIVE_WHYS' && (
        <div className="space-y-3">
          {fiveWhys.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[120px,1fr,1fr]">
              <div className="text-sm font-semibold">{index + 1}º por quê?</div>
              <Input value={item.answer ?? ''} placeholder="Resposta" onChange={(e) => setFiveWhys(updateArray(fiveWhys, index, { ...item, answer: e.target.value }))} />
              <Input value={item.evidence ?? ''} placeholder="Evidência" onChange={(e) => setFiveWhys(updateArray(fiveWhys, index, { ...item, evidence: e.target.value }))} />
            </div>
          ))}
          <Button variant="outline" onClick={() => setFiveWhys([...fiveWhys, { position: fiveWhys.length + 1, question: `${fiveWhys.length + 1}º por quê?`, answer: '', evidence: '' }])}>Adicionar por quê</Button>
        </div>
      )}

      {method === 'ISHIKAWA' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ishikawa.map((item, index) => (
            <div key={index} className="rounded-lg border p-3">
              <div className="mb-2 text-sm font-semibold">{item.category}</div>
              <Textarea rows={2} value={item.description ?? ''} placeholder="Causa possível" onChange={(e) => setIshikawa(updateArray(ishikawa, index, { ...item, description: e.target.value }))} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input type="number" min={1} max={5} value={item.impact ?? 3} onChange={(e) => setIshikawa(updateArray(ishikawa, index, { ...item, impact: Number(e.target.value) }))} />
                <Input type="number" min={1} max={5} value={item.probability ?? 3} onChange={(e) => setIshikawa(updateArray(ishikawa, index, { ...item, probability: Number(e.target.value) }))} />
              </div>
            </div>
          ))}
        </div>
      )}

      {method === 'MASP' && <StepEditor rows={maspSteps} setRows={setMaspSteps} labelKey="title" />}
      {method === 'PDCA' && <StepEditor rows={pdcaSteps} setRows={setPdcaSteps} labelKey="phase" />}
      {!['FIVE_WHYS', 'ISHIKAWA', 'MASP', 'PDCA'].includes(method) && <GenericAnalysis method={method} session={session} />}

      <div className="mt-4">
        <Label>Causa raiz provável</Label>
        <Textarea rows={3} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={saving} onClick={() => onSave({ method, problem, rootCause, fiveWhys, ishikawaCauses: ishikawa, maspSteps, pdcaSteps })}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar análise'}
        </Button>
      </div>
    </SectionCard>
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
