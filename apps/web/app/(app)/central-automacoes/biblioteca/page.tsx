'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import {
  Boxes,
  Search,
  Zap,
  Play,
  Settings,
  HelpCircle,
  Code,
  FileText,
  Clock,
  ArrowRight,
  Database,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlockInfo {
  type: 'TRIGGER' | 'CONDITION' | 'ACTION' | 'HUMAN_TASK' | 'APPROVAL' | 'TIMER' | 'INTEGRATION';
  blockType: string;
  label: string;
  description: string;
  inputs: string[];
  outputs: string[];
  color: string;
  exampleContext: string;
}

const BLOCKS_LIBRARY: BlockInfo[] = [
  {
    type: 'TRIGGER',
    blockType: 'indicator.result_recorded',
    label: 'Lançamento de Indicador',
    description: 'Dispara sempre que um novo resultado ou valor for lançado em qualquer indicador da empresa.',
    inputs: ['Nenhum (Disparado por evento)'],
    outputs: ['indicatorId', 'value', 'periodRef', 'attainment', 'light', 'previousValue'],
    color: 'bg-blue-500/10 border-blue-500 text-blue-500',
    exampleContext: '{\n  "indicatorId": "ind-123",\n  "value": 95,\n  "periodRef": "2026-06",\n  "attainment": 98.5\n}',
  },
  {
    type: 'TRIGGER',
    blockType: 'indicator.out_of_target',
    label: 'Indicador Fora da Meta',
    description: 'Disparado automaticamente quando um indicador for classificado como Fora da Meta (vermelho/amarelo).',
    inputs: ['Nenhum (Disparado por evento)'],
    outputs: ['indicatorId', 'value', 'periodRef', 'attainment', 'targetValue', 'responsibleUserId'],
    color: 'bg-red-500/10 border-red-500 text-red-500',
    exampleContext: '{\n  "indicatorId": "ind-999",\n  "value": 68,\n  "attainment": 72.0,\n  "targetValue": 85\n}',
  },
  {
    type: 'TRIGGER',
    blockType: 'document.published',
    label: 'Documento Publicado',
    description: 'Disparado quando um documento novo ou revisado for aprovado e publicado no módulo GED.',
    inputs: ['Nenhum (Disparado por evento)'],
    outputs: ['documentId', 'title', 'version', 'authorId', 'responsibleUserId'],
    color: 'bg-green-500/10 border-green-500 text-green-500',
    exampleContext: '{\n  "documentId": "doc-045",\n  "title": "Manual de Processos Operacionais",\n  "version": 3\n}',
  },
  {
    type: 'TRIGGER',
    blockType: 'document.expiration_approaching',
    label: 'Documento Próximo ao Vencimento',
    description: 'Disparado pelo cron de monitoramento 30 dias antes do vencimento legal do documento.',
    inputs: ['Nenhum (Disparado por evento)'],
    outputs: ['documentId', 'title', 'expirationDate', 'responsibleUserId'],
    color: 'bg-amber-500/10 border-amber-500 text-amber-500',
    exampleContext: '{\n  "documentId": "doc-111",\n  "expirationDate": "2026-07-08T00:00:00Z"\n}',
  },
  {
    type: 'TRIGGER',
    blockType: 'nonconformity.created',
    label: 'Não Conformidade Registrada',
    description: 'Dispara no cadastro de desvios, reclamações de clientes ou não conformidades de auditoria.',
    inputs: ['Nenhum (Disparado por evento)'],
    outputs: ['deviationId', 'title', 'severity', 'responsibleUserId', 'indicatorId'],
    color: 'bg-orange-500/10 border-orange-500 text-orange-500',
    exampleContext: '{\n  "deviationId": "nc-092",\n  "title": "Vazamento de óleo na prensa 2",\n  "severity": "CRITICAL"\n}',
  },
  {
    type: 'CONDITION',
    blockType: 'logic.condition',
    label: 'Regra Condicional (Se/Senão)',
    description: 'Avalia expressões seguras com variáveis do contexto para direcionar a execução por caminhos distintos (True/False).',
    inputs: ['Qualquer variável do contexto'],
    outputs: ['Caminho lógico correspondente (True / False)'],
    color: 'bg-purple-500/10 border-purple-500 text-purple-500',
    exampleContext: '{\n  "expression": "value < 80"\n}',
  },
  {
    type: 'HUMAN_TASK',
    blockType: 'human.task',
    label: 'Criar Tarefa Humana',
    description: 'Gera uma atividade operacional obrigatória na fila do responsável e aguarda sua conclusão.',
    inputs: ['title (string)', 'description (string)', 'responsibleType (enum)', 'dueDays (number)'],
    outputs: ['taskId', 'completedByUserId', 'evidenceNotes', 'completedAt'],
    color: 'bg-sky-500/10 border-sky-500 text-sky-500',
    exampleContext: '{\n  "title": "Verificar lubrificação",\n  "dueDays": 5\n}',
  },
  {
    type: 'APPROVAL',
    blockType: 'human.approval',
    label: 'Solicitar Aprovação',
    description: 'Exige que um aprovador tome uma decisão de aprovação ou rejeição antes do fluxo prosseguir.',
    inputs: ['approvalType (enum)', 'approverType (enum)', 'dueDays (number)'],
    outputs: ['approved (boolean)', 'approverId', 'comments', 'respondedAt'],
    color: 'bg-indigo-500/10 border-indigo-500 text-indigo-500',
    exampleContext: '{\n  "approvalType": "SIMPLE",\n  "role": "MANAGER"\n}',
  },
  {
    type: 'TIMER',
    blockType: 'logic.timer',
    label: 'Aguardar (atraso/temporizador)',
    description: 'Pausa a execução do fluxo por um período determinado de dias, horas ou até uma data específica.',
    inputs: ['timerType (enum)', 'durationDays (number)', 'durationHours (number)'],
    outputs: ['Nenhum (Retoma o fluxo após término)'],
    color: 'bg-teal-500/10 border-teal-500 text-teal-500',
    exampleContext: '{\n  "timerType": "DELAY",\n  "durationDays": 3\n}',
  },
  {
    type: 'ACTION',
    blockType: 'action.deviation.create',
    label: 'Criar Desvio (FCA)',
    description: 'Abre automaticamente um novo Desvio/FCA vinculado ao indicador no banco de dados do Gestão 360.',
    inputs: ['title (string)', 'severity (enum)', 'responsibleUserId (string)'],
    outputs: ['deviationId', 'deviationNumber'],
    color: 'bg-pink-500/10 border-pink-500 text-pink-500',
    exampleContext: '{\n  "title": "Análise de Causa Raiz - {{name}}",\n  "severity": "HIGH"\n}',
  },
  {
    type: 'ACTION',
    blockType: 'action.plan.create',
    label: 'Criar Plano de Ação',
    description: 'Gera um Plano de Ação (5W2H) completo para tratar desvios e incidentes de forma sistêmica.',
    inputs: ['title (string)', 'priority (enum)', 'criticality (enum)', 'responsibleUserId (string)'],
    outputs: ['actionPlanId'],
    color: 'bg-rose-500/10 border-rose-500 text-rose-500',
    exampleContext: '{\n  "title": "Plano de Contenção de Riscos",\n  "priority": "HIGH"\n}',
  },
  {
    type: 'INTEGRATION',
    blockType: 'integration.webhook',
    label: 'Disparar chamada de API',
    description: 'Realiza chamadas HTTP POST/PUT externas enviando as variáveis do fluxo de trabalho para outros sistemas da empresa.',
    inputs: ['url (string)', 'method (enum)', 'headers (JSON)', 'body (JSON)'],
    outputs: ['statusCode', 'responseBody', 'integrationSuccess'],
    color: 'bg-emerald-500/10 border-emerald-500 text-emerald-500',
    exampleContext: '{\n  "url": "https://api.empresa.com/v1/alerts",\n  "method": "POST"\n}',
  },
];

export default function BlocksLibraryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedBlock, setSelectedBlock] = useState<BlockInfo | null>(BLOCKS_LIBRARY[0]);

  const categories = ['ALL', 'TRIGGER', 'CONDITION', 'HUMAN_TASK', 'APPROVAL', 'TIMER', 'ACTION', 'INTEGRATION'];

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'TRIGGER':
        return 'Gatilhos';
      case 'CONDITION':
        return 'Condições';
      case 'HUMAN_TASK':
        return 'Tarefas Humana';
      case 'APPROVAL':
        return 'Aprovações';
      case 'TIMER':
        return 'Temporizadores';
      case 'ACTION':
        return 'Ações de Banco';
      case 'INTEGRATION':
        return 'Integrações';
      default:
        return 'Todos';
    }
  };

  const filtered = BLOCKS_LIBRARY.filter((b) => {
    const matchesCategory = selectedCategory === 'ALL' ? true : b.type === selectedCategory;
    const matchesSearch =
      b.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.blockType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
      <PageHeader
        eyebrow="Central de Automações"
        title="Biblioteca de Blocos do Motor"
        description="Explore as capacidades técnicas, variáveis de contexto, estruturas de dados de entrada e saída aceitas pelo nosso motor visual de execução."
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-6 min-h-0 w-full overflow-hidden">
        {/* Left Side: Blocks Grid list */}
        <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
          {/* Filter Toolbar */}
          <div className="p-4 border-b bg-muted/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
            <div className="flex flex-wrap items-center gap-1">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs px-2.5"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {getCategoryLabel(cat)}
                </Button>
              ))}
            </div>

            <div className="relative w-full md:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar blocos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none"
              />
            </div>
          </div>

          {/* Grid list of blocks */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((block) => {
                const isSelected = selectedBlock?.blockType === block.blockType;
                return (
                  <div
                    key={block.blockType}
                    onClick={() => setSelectedBlock(block)}
                    className={cn(
                      'p-4 border rounded-xl hover:bg-muted/15 transition-all cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden',
                      isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-card'
                    )}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
                          {block.type}
                        </span>
                        <Zap className="h-3 w-3 text-primary opacity-60" />
                      </div>
                      <h4 className="text-xs font-bold text-foreground">{block.label}</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                        {block.description}
                      </p>
                    </div>

                    <div className="text-[10px] font-mono text-muted-foreground truncate border-t pt-2 mt-1">
                      {block.blockType}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Selected Block Spec Panel */}
        <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
          {selectedBlock ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="p-4 border-b bg-muted/10 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Boxes className="h-4 w-4 text-primary" />
                    Especificação do Bloco
                  </h3>
                  <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded border', selectedBlock.color)}>
                    {selectedBlock.type}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-foreground mt-2">{selectedBlock.label}</h4>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{selectedBlock.blockType}</p>
              </div>

              {/* Specs body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Funcionamento</label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedBlock.description}
                  </p>
                </div>

                {/* Inputs & Outputs columns */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Settings className="h-3 w-3 text-primary" />
                      Parâmetros (Input)
                    </label>
                    <div className="bg-muted/30 border rounded-lg p-2.5 space-y-1">
                      {selectedBlock.inputs.map((inp, idx) => (
                        <div key={idx} className="text-[10px] font-mono text-foreground break-words leading-tight flex items-start gap-1">
                          <span className="text-primary">•</span>
                          <span>{inp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Code className="h-3 w-3 text-primary" />
                      Variáveis (Output)
                    </label>
                    <div className="bg-muted/30 border rounded-lg p-2.5 space-y-1">
                      {selectedBlock.outputs.map((out, idx) => (
                        <div key={idx} className="text-[10px] font-mono text-foreground break-words leading-tight flex items-start gap-1">
                          <span className="text-emerald-500">•</span>
                          <span>{out}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Schema JSON context */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Terminal className="h-3.5 w-3.5" />
                    Exemplo de Carga Útil (JSON Context)
                  </label>
                  <pre className="p-3 bg-muted/40 border border-dashed rounded-lg text-[10px] font-mono overflow-auto leading-relaxed text-foreground max-h-[200px] select-all">
                    {selectedBlock.exampleContext}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-xs text-muted-foreground">
              <Boxes className="h-8 w-8 opacity-40 mb-2" />
              Selecione um bloco da biblioteca para ver suas regras de schemas e variáveis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
