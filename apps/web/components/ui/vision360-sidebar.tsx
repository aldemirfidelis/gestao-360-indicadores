import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Network, Copy, ExternalLink, X, Search, ChevronDown, Plus, Trash2,
  AlertTriangle, Calendar, ScrollText, Users, CheckCircle2, Clock,
  FileSpreadsheet, ShieldAlert, BookOpen, GraduationCap, ClipboardList,
  History, Building2, HelpCircle
} from 'lucide-react';
import { useVision360 } from './vision360-context';
import { api } from '@/lib/api';
import { Button } from './button';
import { Input } from './input';
import { Badge } from './badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { StatusLight } from './status-light';
import { Label } from './label';
import { Textarea } from './textarea';

interface Vision360Data {
  summary: {
    id: string;
    type: string;
    name: string;
    code: string | null;
    status: string;
    responsibleName: string | null;
    responsibleId: string | null;
    orgNodeName: string | null;
    orgNodeId: string | null;
    updatedAt: string | null;
  };
  breadcrumbs: {
    entityType: string;
    entityId: string;
    label: string;
    type?: string;
  }[];
  relationships: {
    id: string;
    targetId: string;
    targetType: string;
    targetName: string;
    targetCode: string | null;
    targetStatus: string;
    targetResponsible: string | null;
    relationshipType: string;
    direction: 'DIRECT' | 'INDIRECT';
    criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    isMandatory: boolean;
    originType: 'AUTOMATIC' | 'MANUAL';
  }[];
}

const SECTION_KEYS = [
  'origem', 'vinculos', 'dependencias', 'impactos', 'registrosImpactados',
  'responsaveis', 'indicadores', 'riscos', 'auditorias', 'documentos',
  'requisitos', 'treinamentos', 'formularios', 'reunioes', 'acoes', 'historico'
];

export const Vision360Sidebar: React.FC = () => {
  const { isOpen, entityType, entityId, historyStack, close, navigateTo, goBack } = useVision360();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, DIRECT, DEPENDENCY, IMPACT, CRITICAL, OVERDUE, etc.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ origem: true, vinculos: true });
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  // Form para novo vinculo manual
  const [newLink, setNewLink] = useState({
    targetEntityType: 'INDICATOR',
    targetEntityId: '',
    relationshipType: 'pertence_a',
    criticality: 'MEDIUM',
    isMandatory: false,
    notes: ''
  });

  const { data, isLoading, refetch } = useQuery<Vision360Data>({
    queryKey: ['vision360-links', entityType, entityId],
    queryFn: () => api<Vision360Data>(`/vision360/links?type=${entityType}&id=${entityId}`),
    enabled: isOpen && !!entityType && !!entityId,
  });

  const addLinkMutation = useMutation({
    mutationFn: (body: any) => api('/vision360/links', { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Vínculo criado com sucesso!');
      setLinkModalOpen(false);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao criar vínculo');
    }
  });

  const removeLinkMutation = useMutation({
    mutationFn: (linkId: string) => api(`/vision360/links/${linkId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Vínculo removido com sucesso!');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao remover vínculo');
    }
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const copyDirectLink = () => {
    if (!data) return;
    const url = `${window.location.origin}/${data.summary.type.toLowerCase()}s/${data.summary.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado para a área de transferência!');
  };

  const openFullPage = () => {
    if (!data) return;
    const route = `/${data.summary.type.toLowerCase()}s/${data.summary.id}`;
    window.location.href = route;
  };

  const downloadXlsxReport = () => {
    if (!entityType || !entityId) return;
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/vision360/export-xlsx?type=${entityType}&id=${entityId}`);
  };

  // Filtragem e Pesquisa de Vínculos
  const filteredRelationships = useMemo(() => {
    if (!data) return [];
    return data.relationships.filter((rel) => {
      // 1. Pesquisa
      const matchesSearch =
        rel.targetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rel.targetCode && rel.targetCode.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // 2. Filtros Rápidos
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'DIRECT') return rel.direction === 'DIRECT';
      if (activeFilter === 'DEPENDENCIES') return rel.relationshipType.includes('depende_de') || rel.isMandatory;
      if (activeFilter === 'IMPACTS') return rel.relationshipType.includes('impacta') || rel.relationshipType.includes('consequencia');
      if (activeFilter === 'CRITICAL') return rel.criticality === 'CRITICAL' || rel.criticality === 'HIGH';
      if (activeFilter === 'RISKS') return rel.targetType === 'RISK' || rel.targetType === 'RISK_REGISTER';
      if (activeFilter === 'DOCUMENTS') return rel.targetType === 'DOCUMENT';
      if (activeFilter === 'ACTIONS') return rel.targetType === 'ACTION_PLAN';
      
      return true;
    });
  }, [data, searchTerm, activeFilter]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[460px] flex-col border-l border-border bg-background/95 shadow-2xl backdrop-blur-md transition-all duration-300">
        
        {/* Cabeçalho Fixo */}
        <div className="sticky top-0 z-10 border-b border-border bg-card/65 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Visão 360° do Registro
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {historyStack.length > 1 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={goBack}>
                  Voltar ({historyStack.length - 1})
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading && (
            <div className="mt-4 animate-pulse space-y-2">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          )}

          {data && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-primary/5 uppercase font-medium">
                  {data.summary.type}
                </Badge>
                {data.summary.code && <Badge variant="secondary">{data.summary.code}</Badge>}
                <StatusLight light={data.summary.status as any} size="sm" />
              </div>
              <h3 className="mt-1.5 text-base font-bold text-foreground leading-tight">
                {data.summary.name}
              </h3>
              
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Responsável: <strong className="text-foreground">{data.summary.responsibleName ?? 'Sem responsável'}</strong></div>
                <div>Estrutura: <strong className="text-foreground">{data.summary.orgNodeName ?? 'Empresa Geral'}</strong></div>
              </div>

              {/* Botões rápidos */}
              <div className="mt-3 flex items-center gap-1.5 border-t pt-3">
                <Button variant="outline" size="sm" className="h-8 text-xs flex-1 gap-1" onClick={openFullPage}>
                  <ExternalLink className="h-3 w-3" /> Acessar Página
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs flex-1 gap-1" onClick={copyDirectLink}>
                  <Copy className="h-3 w-3" /> Copiar Link
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs flex-1 gap-1" onClick={downloadXlsxReport} title="Exportar para Excel">
                  <FileSpreadsheet className="h-3 w-3" /> Planilha
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Filtros e Barra de Pesquisa */}
        <div className="border-b border-border bg-muted/40 p-3 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Localizar vínculos..."
              className="h-8 pl-8 text-xs placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { key: 'ALL', label: 'Todos' },
              { key: 'DIRECT', label: 'Vínculos Diretos' },
              { key: 'DEPENDENCIES', label: 'Dependências' },
              { key: 'IMPACTS', label: 'Impactos' },
              { key: 'CRITICAL', label: 'Críticos' },
              { key: 'RISKS', label: 'Riscos' },
              { key: 'DOCUMENTS', label: 'Documentos' },
              { key: 'ACTIONS', label: 'Ações' }
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                  activeFilter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted border border-border/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Blocos Acordeons com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
          
          {/* Seção 1: Origem e Contexto */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection('origem')}
              className="flex w-full items-center justify-between p-3 text-left font-semibold text-foreground hover:bg-muted/30"
            >
              <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                Origem e Contexto
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections.origem ? 'rotate-180' : ''}`} />
            </button>
            {openSections.origem && data && (
              <div className="border-t border-border bg-muted/10 p-3 space-y-2 text-xs">
                <div className="font-semibold text-muted-foreground">Caminho de Rastreabilidade (Breadcrumb):</div>
                <div className="flex flex-wrap items-center gap-1 rounded bg-background p-2 border">
                  {data.breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={`${crumb.entityType}-${crumb.entityId}`}>
                      {idx > 0 && <span className="text-muted-foreground/50">&rarr;</span>}
                      <button
                        onClick={() => navigateTo(crumb.entityType, crumb.entityId, crumb.label)}
                        className="font-medium text-primary hover:underline"
                      >
                        {crumb.label}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                {data.summary.updatedAt && (
                  <div className="text-[10px] text-muted-foreground mt-2">
                    Última Atualização: {new Date(data.summary.updatedAt).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seção 2: Vínculos Diretos e Manuais */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection('vinculos')}
              className="flex w-full items-center justify-between p-3 text-left font-semibold text-foreground hover:bg-muted/30"
            >
              <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Network className="h-4 w-4 text-primary" />
                Vínculos ({filteredRelationships.length})
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={(e) => { e.stopPropagation(); setLinkModalOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections.vinculos ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {openSections.vinculos && (
              <div className="border-t border-border bg-muted/10 p-3 space-y-2 text-xs">
                {filteredRelationships.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">Nenhum vínculo correspondente encontrado.</div>
                ) : (
                  <div className="space-y-2">
                    {filteredRelationships.map((rel) => (
                      <div key={rel.id} className="relative rounded-lg border bg-background p-2.5 shadow-sm transition hover:border-primary/45">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {rel.targetType}
                            </span>
                            {rel.targetCode && <span className="ml-1 text-[10px] font-mono text-muted-foreground">({rel.targetCode})</span>}
                            <button
                              onClick={() => navigateTo(rel.targetType, rel.targetId, rel.targetName)}
                              className="mt-1 block font-semibold text-foreground text-left hover:underline hover:text-primary truncate w-full"
                            >
                              {rel.targetName}
                            </button>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                              <span className="font-semibold capitalize text-primary bg-primary/5 px-1 rounded">
                                {rel.relationshipType.replace(/_/g, ' ')}
                              </span>
                              <span>•</span>
                              <span>Resp: {rel.targetResponsible ?? '-'}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1.5">
                            <StatusLight light={rel.targetStatus as any} />
                            {rel.originType === 'MANUAL' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeLinkMutation.mutate(rel.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-[9px] uppercase font-mono px-1 py-0 bg-secondary/5 font-semibold text-amber-600 border-amber-300">
                                AUTO
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Outros Acordeons (3 a 16) baseados em tipos específicos */}
          {[
            { key: 'dependencias', label: 'Dependências e Bloqueios', icon: AlertTriangle, filterType: 'DEPENDENCIES' },
            { key: 'impactos', label: 'Impactos Estimados', icon: ShieldAlert, filterType: 'IMPACTS' },
            { key: 'indicadores', label: 'Indicadores Associados', icon: FileSpreadsheet, targetType: 'INDICATOR' },
            { key: 'riscos', label: 'Riscos e Controles', icon: ShieldAlert, targetType: 'RISK' },
            { key: 'auditorias', label: 'Auditorias e Conformidade', icon: BookOpen, targetType: 'AUDIT' },
            { key: 'documentos', label: 'Documentos do GED', icon: ScrollText, targetType: 'DOCUMENT' },
            { key: 'requisitos', label: 'Requisitos Legais/Normativos', icon: BookOpen, targetType: 'REQUISITO' },
            { key: 'treinamentos', label: 'Treinamentos e Competências', icon: GraduationCap, targetType: 'TREINAMENTO' },
            { key: 'formularios', label: 'Formulários e Checklists', icon: ClipboardList, targetType: 'FORM' },
            { key: 'reunioes', label: 'Decisões em Reuniões', icon: Users, targetType: 'MEETING' },
            { key: 'acoes', label: 'Planos de Ação e Tarefas', icon: ClipboardList, targetType: 'ACTION_PLAN' },
            { key: 'historico', label: 'Trilha de Histórico & Auditoria', icon: History, isAudit: true },
          ].map((sec) => {
            const items = data ? data.relationships.filter((rel) => {
              if (sec.targetType) return rel.targetType === sec.targetType || rel.targetType === `${sec.targetType}_REGISTER`;
              if (sec.filterType === 'DEPENDENCIES') return rel.relationshipType.includes('depende') || rel.isMandatory;
              if (sec.filterType === 'IMPACTS') return rel.relationshipType.includes('impacta');
              return false;
            }) : [];

            if (items.length === 0 && !sec.isAudit) return null; // Oculta acordeons vazios

            return (
              <div key={sec.key} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection(sec.key)}
                  className="flex w-full items-center justify-between p-3 text-left font-semibold text-foreground hover:bg-muted/30"
                >
                  <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <sec.icon className="h-4 w-4 text-primary" />
                    {sec.label} ({sec.isAudit ? 'Logs' : items.length})
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections[sec.key] ? 'rotate-180' : ''}`} />
                </button>
                {openSections[sec.key] && (
                  <div className="border-t border-border bg-muted/10 p-3 space-y-2 text-xs">
                    {sec.isAudit ? (
                      <div className="text-[11px] text-muted-foreground text-center py-4">
                        Histórico completo disponível na aba Auditoria do registro original.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {items.map((rel) => (
                          <div key={rel.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
                            <div className="min-w-0">
                              <button
                                onClick={() => navigateTo(rel.targetType, rel.targetId, rel.targetName)}
                                className="font-medium hover:underline hover:text-primary text-foreground text-left block truncate"
                              >
                                {rel.targetName}
                              </button>
                              <div className="text-[10px] text-muted-foreground">
                                Relação: <span className="text-primary font-semibold capitalize">{rel.relationshipType.replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {rel.isMandatory && <span className="rounded bg-rose-600/10 px-1 py-0.5 text-[9px] font-bold uppercase text-rose-600">Obrigatório</span>}
                              <StatusLight light={rel.targetStatus as any} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Vincular Registro Manual */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular Novo Registro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label>Tipo de Entidade</Label>
              <select
                value={newLink.targetEntityType}
                onChange={(e) => setNewLink({ ...newLink, targetEntityType: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="INDICATOR">Indicador</option>
                <option value="PROCESS">Processo</option>
                <option value="DOCUMENT">Documento</option>
                <option value="RISK">Risco</option>
                <option value="NON_CONFORMITY">Não Conformidade</option>
                <option value="ACTION_PLAN">Plano de Ação</option>
                <option value="MEETING">Reunião</option>
                <option value="PROJECT">Projeto</option>
                <option value="DEVIATION">Desvio</option>
                <option value="AUDIT">Auditoria</option>
              </select>
            </div>

            <div>
              <Label>ID do Registro de Destino</Label>
              <Input
                value={newLink.targetEntityId}
                onChange={(e) => setNewLink({ ...newLink, targetEntityId: e.target.value })}
                placeholder="Insira o ID (UUID) do registro"
                className="h-9"
              />
            </div>

            <div>
              <Label>Tipo de Relacionamento</Label>
              <select
                value={newLink.relationshipType}
                onChange={(e) => setNewLink({ ...newLink, relationshipType: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="pertence_a">Pertence a</option>
                <option value="depende_de">Depende de</option>
                <option value="impacta">Impacta</option>
                <option value="atende">Atende</option>
                <option value="controlado_por">É controlado por</option>
                <option value="exige_treinamento">Exige treinamento</option>
                <option value="utiliza_documento">Utiliza documento</option>
                <option value="discussao_reuniao">Discutido em Reunião</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Criticidade</Label>
                <select
                  value={newLink.criticality}
                  onChange={(e) => setNewLink({ ...newLink, criticality: e.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
                >
                  <option value="CRITICAL">Crítico</option>
                  <option value="HIGH">Alto</option>
                  <option value="MEDIUM">Médio</option>
                  <option value="LOW">Baixo</option>
                  <option value="INFO">Informativo</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isMandatory"
                  checked={newLink.isMandatory}
                  onChange={(e) => setNewLink({ ...newLink, isMandatory: e.target.checked })}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="isMandatory" className="cursor-pointer">Obrigatório?</Label>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={newLink.notes}
                onChange={(e) => setNewLink({ ...newLink, notes: e.target.value })}
                placeholder="Descreva observações ou motivo do relacionamento"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkModalOpen(false)}>Cancelar</Button>
            <Button
              disabled={!newLink.targetEntityId || addLinkMutation.isPending}
              onClick={() => addLinkMutation.mutate({
                sourceEntityType: entityType,
                sourceEntityId: entityId,
                ...newLink
              })}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
