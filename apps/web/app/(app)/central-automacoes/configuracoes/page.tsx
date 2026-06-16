'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/platform/section-card';
import {
  Settings,
  ShieldCheck,
  Database,
  Cpu,
  Clock,
  Save,
  CheckCircle,
  AlertOctagon,
} from 'lucide-react';
import { toast } from 'sonner';

export default function EngineSettingsPage() {
  const [pollingInterval, setPollingInterval] = useState(5);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(30);
  const [redisQueue, setRedisQueue] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [debugLogs, setDebugLogs] = useState(true);

  const handleSave = () => {
    toast.success('Configurações globais do motor salvas e aplicadas!');
  };

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0 bg-muted/20">
      <PageHeader
        eyebrow="Central de Automações"
        title="Configurações do Motor"
        description="Configure variáveis de infraestrutura do motor de fluxos de trabalho, concorrência de temporizadores, regras de fila (DLQ) e parâmetros de execução global."
      />

      <div className="max-w-4xl space-y-6 overflow-y-auto pr-1">
        {/* Core Engine parameters */}
        <SectionCard title="Configurações de Execução e Fila" description="Ajuste como a engine processa temporizadores e recupera falhas.">
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Polling Interval */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5 uppercase">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Intervalo de Varredura de Temporizadores (Polling)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={pollingInterval}
                    onChange={(e) => setPollingInterval(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs font-semibold w-12 text-right text-foreground">{pollingInterval}s</span>
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  Tempo entre execuções da query `FOR UPDATE SKIP LOCKED` para verificar alarmes acumulados no banco.
                </span>
              </div>

              {/* Max Retries */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5 uppercase">
                  <AlertOctagon className="h-3.5 w-3.5 text-primary" />
                  Número Máximo de Tentativas (Retries)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  Tentativas de processamento antes de redirecionar um nó falho para a fila de mensagens com falha (DLQ).
                </span>
              </div>

              {/* Retry Delay */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5 uppercase">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  Intervalo de Reprocessamento
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={retryDelay}
                    onChange={(e) => setRetryDelay(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none"
                  />
                  <span className="text-xs font-semibold text-foreground">segundos</span>
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  Segundos a aguardar entre tentativas de reprocessar blocos automáticos instáveis.
                </span>
              </div>

              {/* Infrastructure queue type */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5 uppercase">
                  <Database className="h-3.5 w-3.5 text-primary" />
                  Barramento de Fila Alternativo (Redis/BullMQ)
                </label>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {redisQueue ? 'Fila Redis Habilitada (Produção)' : 'Fila em Banco de Dados (PostgreSQL)'}
                  </span>
                  <input
                    type="checkbox"
                    checked={redisQueue}
                    onChange={(e) => setRedisQueue(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground block mt-1">
                  Se ativado, utiliza o BullMQ/Redis em vez da tabela `WorkflowTimer` nativa do banco.
                </span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* System parameters */}
        <SectionCard title="Notificações e Auditoria" description="Habilite registros detalhados e avisos por e-mail de SLAs.">
          <div className="p-5 space-y-4">
            {/* Email notification */}
            <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">Enviar E-mails de SLA</span>
                <span className="text-[10px] text-muted-foreground">
                  Gera disparos de e-mail ao notificar ou escalar tarefas de fluxo de trabalho pendentes.
                </span>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </div>

            {/* Verbose Debug Logs */}
            <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">Registros de Depuração Verbosos</span>
                <span className="text-[10px] text-muted-foreground">
                  Grava registros técnicos estendidos da engine na tabela `WorkflowExecutionLog` para fins de auditoria detalhada.
                </span>
              </div>
              <input
                type="checkbox"
                checked={debugLogs}
                onChange={(e) => setDebugLogs(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </div>
          </div>
        </SectionCard>

        {/* Footer save btn */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" className="h-9 text-xs">
            Restaurar Padrões
          </Button>
          <Button className="h-9 text-xs flex items-center gap-1.5" onClick={handleSave}>
            <Save className="h-4 w-4" />
            Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
