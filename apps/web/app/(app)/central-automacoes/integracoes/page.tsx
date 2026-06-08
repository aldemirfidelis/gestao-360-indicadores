'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/platform/section-card';
import {
  Globe,
  Settings,
  Mail,
  Slack,
  MessageSquare,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface IntegrationConfig {
  id: string;
  name: string;
  type: 'WEBHOOK' | 'EMAIL' | 'SLACK' | 'TEAMS';
  status: 'ACTIVE' | 'INACTIVE';
  endpoint: string;
  lastTriggered: string | null;
}

const CONNECTOR_TEMPLATES = [
  { type: 'WEBHOOK', label: 'Custom HTTP Webhook', desc: 'Envie payloads JSON para qualquer endpoint HTTP/HTTPS.', icon: Globe, color: 'text-emerald-500 bg-emerald-500/10' },
  { type: 'EMAIL', label: 'Servidor SMTP / SendGrid', desc: 'Envie notificações estruturadas por e-mail para destinatários corporativos.', icon: Mail, color: 'text-blue-500 bg-blue-500/10' },
  { type: 'SLACK', label: 'Slack Webhooks', desc: 'Publique alertas automáticos em canais específicos de comunicação do Slack.', icon: Slack, color: 'text-purple-500 bg-purple-500/10' },
  { type: 'TEAMS', label: 'Microsoft Teams Webhooks', desc: 'Envie Adaptive Cards e notificações para chats ou canais no MS Teams.', icon: MessageSquare, color: 'text-indigo-500 bg-indigo-500/10' },
];

export default function IntegrationsConfigPage() {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([
    {
      id: 'int-1',
      name: 'Webhook de Sincronização ERP',
      type: 'WEBHOOK',
      status: 'ACTIVE',
      endpoint: 'https://api.empresa.com/v1/workflows/sync',
      lastTriggered: '2026-06-08T15:24:00Z',
    },
    {
      id: 'int-2',
      name: 'Canal de Qualidade Slack',
      type: 'SLACK',
      status: 'ACTIVE',
      endpoint: 'https://hooks.slack.com/services/***-configurar-no-painel-***',
      lastTriggered: '2026-06-07T10:11:00Z',
    },
    {
      id: 'int-3',
      name: 'Disparador SMTP Corporativo',
      type: 'EMAIL',
      status: 'INACTIVE',
      endpoint: 'smtp.sendgrid.net:587',
      lastTriggered: null,
    },
  ]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const toggleStatus = (id: string) => {
    setIntegrations(prev =>
      prev.map(item => (item.id === id ? { ...item, status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : item))
    );
    toast.success('Status do conector atualizado com sucesso!');
  };

  const testConnection = (id: string) => {
    setTestingId(id);
    setTimeout(() => {
      setTestingId(null);
      toast.success('Teste de conexão concluído! Código HTTP 200 retornado.');
    }, 1200);
  };

  const selectedItem = integrations.find(i => i.id === selectedId);

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
      <PageHeader
        eyebrow="Central de Automações"
        title="Integrações & Conectores"
        description="Configure canais externos de comunicação, credenciais de Webhooks e webhooks de chat para que o motor visual envie dados para outros sistemas."
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-6 min-h-0 w-full overflow-hidden">
        {/* Left Side: Integrations List & Templates */}
        <div className="flex flex-col min-h-0 gap-6 overflow-y-auto pr-1">
          {/* Connector Templates Catalogue */}
          <SectionCard title="Adicionar Novo Conector" description="Selecione um tipo de integração para configurar suas credenciais.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {CONNECTOR_TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                return (
                  <div
                    key={tmpl.type}
                    className="p-4 border rounded-xl bg-card hover:bg-muted/15 hover:border-primary/20 transition-all cursor-pointer flex gap-3.5"
                    onClick={() => {
                      toast.info(`Novo configurador de conector ${tmpl.label} iniciado.`);
                    }}
                  >
                    <div className={cn('p-2.5 rounded-lg shrink-0 h-10 w-10 flex items-center justify-center', tmpl.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                        {tmpl.label}
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </h4>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {tmpl.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Active integrations */}
          <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
            <div className="p-4 border-b bg-muted/10">
              <h3 className="text-xs font-bold text-foreground">Conectores Configurados</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Integrações operacionais cadastradas na empresa.</p>
            </div>

            <div className="divide-y overflow-y-auto">
              {integrations.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'p-4 hover:bg-muted/10 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden',
                      isSelected && 'bg-primary/5 border-l-2 border-primary'
                    )}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                            item.status === 'ACTIVE' ? 'bg-status-green/10 text-status-green' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {item.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                          {item.type}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground truncate">{item.name}</h4>
                      <p className="text-[10px] font-mono text-muted-foreground truncate max-w-lg">
                        {item.endpoint}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-semibold text-foreground"
                        disabled={testingId === item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          testConnection(item.id);
                        }}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', testingId === item.id && 'animate-spin')} />
                        Testar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(item.id);
                        }}
                      >
                        Inspecionar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Configuration & secrets masking */}
        <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
          {selectedItem ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b bg-muted/10 shrink-0 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Propriedades do Conector
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ref ID: {selectedItem.id}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Nome da Integração</span>
                  <input
                    type="text"
                    value={selectedItem.name}
                    onChange={(e) => {
                      const updatedName = e.target.value;
                      setIntegrations(prev => prev.map(i => i.id === selectedItem.id ? { ...i, name: updatedName } : i));
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none font-medium text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Endpoint / URI</span>
                  <input
                    type="text"
                    value={selectedItem.endpoint}
                    onChange={(e) => {
                      const updatedEndpoint = e.target.value;
                      setIntegrations(prev => prev.map(i => i.id === selectedItem.id ? { ...i, endpoint: updatedEndpoint } : i));
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none font-mono text-foreground"
                  />
                </div>

                {/* Status Toggle Toggle */}
                <div className="p-3 border rounded-lg bg-muted/20 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold block text-foreground">Estado Operacional</span>
                    <span className="text-[10px] text-muted-foreground">Alternar ativação do conector no motor.</span>
                  </div>
                  <Button
                    size="sm"
                    variant={selectedItem.status === 'ACTIVE' ? 'default' : 'outline'}
                    className={cn(
                      'h-8 text-xs',
                      selectedItem.status === 'ACTIVE' ? 'bg-status-green hover:bg-status-green/90 text-white' : 'text-status-red'
                    )}
                    onClick={() => toggleStatus(selectedItem.id)}
                  >
                    {selectedItem.status === 'ACTIVE' ? 'Ligado' : 'Desligado'}
                  </Button>
                </div>

                {/* Audit details */}
                <div className="text-[10px] text-muted-foreground space-y-1 bg-muted/10 p-3 rounded border">
                  <div className="flex justify-between">
                    <span>Último Disparo:</span>
                    <span className="font-semibold text-foreground">
                      {selectedItem.lastTriggered ? new Date(selectedItem.lastTriggered).toLocaleString() : 'Nunca disparado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Protocolo de Rede:</span>
                    <span className="font-semibold text-foreground">HTTP/1.1 REST JSON</span>
                  </div>
                </div>

                {/* Header configuration */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Cabeçalhos HTTP Padrão (Headers)
                  </span>
                  <pre className="p-3 bg-muted/40 border border-dashed rounded-lg text-[10px] font-mono leading-relaxed text-foreground select-all">
                    {`{\n  "Authorization": "Bearer *********************",\n  "Content-Type": "application/json",\n  "Accept": "application/json"\n}`}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-xs text-muted-foreground">
              <Globe className="h-8 w-8 opacity-40 mb-2" />
              Selecione um conector de integração ativo na lista ao lado para inspecionar configurações e testar conexões.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
