import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AlertTriangle, Info, ShieldAlert, CheckCircle2, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Label } from './label';
import { Textarea } from './textarea';
import { Input } from './input';
import { Badge } from './badge';
import { toast } from 'sonner';

interface ImpactConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: { justification: string; affectedItems: any[] }) => void;
  entityType: string;
  entityId: string;
  operationType: string; // "UPDATE" | "DELETE" | "INACTIVE"
  changeSummary: string;
  previousValues?: string;
  newValues?: string;
}

interface SimulatedImpact {
  affectedEntityType: string;
  affectedEntityId: string;
  affectedName: string;
  affectedCode: string | null;
  affectedStatus: string;
  affectedResponsible: string | null;
  relationshipPath: string;
  impactLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  isMandatory: boolean;
  impactReason: string;
}

interface UserOption {
  id: string;
  name: string;
}

export const ImpactConfirmationModal: React.FC<ImpactConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entityType,
  entityId,
  operationType,
  changeSummary,
  previousValues = '{}',
  newValues = '{}',
}) => {
  const [justification, setJustification] = useState('');
  const [itemsConfig, setItemsConfig] = useState<Record<string, {
    requiresReview: boolean;
    requiresTask: boolean;
    responsibleUserId: string;
    dueDate: string;
    recommendedAction: string;
  }>>({});

  // Busca simulacao de impactos
  const { data: simulatedImpacts, isLoading } = useQuery<SimulatedImpact[]>({
    queryKey: ['impact-simulation', entityType, entityId],
    queryFn: () => api<SimulatedImpact[]>(`/vision360/impact-simulation?type=${entityType}&id=${entityId}&depth=3`),
    enabled: isOpen && !!entityType && !!entityId,
  });

  // Busca lista de usuarios para atribuicao de tarefas
  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['users-options-impact'],
    queryFn: () => api<UserOption[]>('/processes/options').then((res: any) => res.users || []),
    enabled: isOpen,
  });

  // Inicializa configuracoes dos itens quando os impactos sao carregados
  useEffect(() => {
    if (simulatedImpacts) {
      const config: typeof itemsConfig = {};
      simulatedImpacts.forEach((imp) => {
        const key = `${imp.affectedEntityType}-${imp.affectedEntityId}`;
        config[key] = {
          requiresReview: imp.isMandatory || imp.impactLevel === 'CRITICAL' || imp.impactLevel === 'HIGH',
          requiresTask: imp.impactLevel === 'CRITICAL',
          responsibleUserId: '',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias de prazo
          recommendedAction: `Adequar ${imp.affectedEntityType.toLowerCase()} devido à alteração de ${entityType.toLowerCase()}`,
        };
      });
      setItemsConfig(config);
    }
  }, [simulatedImpacts, entityType]);

  const handleConfirm = () => {
    if (!justification.trim()) {
      toast.error('Por favor, informe a justificativa para esta alteração.');
      return;
    }

    const affectedItems = (simulatedImpacts || []).map((imp) => {
      const key = `${imp.affectedEntityType}-${imp.affectedEntityId}`;
      const conf = itemsConfig[key];
      return {
        affectedEntityType: imp.affectedEntityType,
        affectedEntityId: imp.affectedEntityId,
        relationshipPath: imp.relationshipPath,
        impactReason: imp.impactReason,
        impactLevel: imp.impactLevel,
        recommendedAction: conf?.recommendedAction,
        requiresReview: conf?.requiresReview ?? false,
        requiresTask: conf?.requiresTask ?? false,
        responsibleUserId: conf?.responsibleUserId || null,
        dueDate: conf?.dueDate ? new Date(conf.dueDate).toISOString() : null,
      };
    });

    onConfirm({
      justification,
      affectedItems,
    });
  };

  const hasHighImpacts = (simulatedImpacts || []).some(
    (imp) => imp.impactLevel === 'CRITICAL' || imp.impactLevel === 'HIGH' || imp.isMandatory
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-rose-600">
            <ShieldAlert className="h-5 w-5" />
            Análise de Impacto da Alteração
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Resumo da operacao */}
          <div className="rounded-lg bg-muted/40 p-3.5 border border-border">
            <h3 className="font-semibold text-foreground">Resumo da Alteração</h3>
            <p className="mt-1 text-xs text-muted-foreground">{changeSummary}</p>
            <div className="mt-2.5 flex items-center gap-4 text-xs">
              <div>Operação: <Badge variant="secondary" className="uppercase font-semibold">{operationType}</Badge></div>
              <div>Entidade: <Badge variant="outline" className="uppercase">{entityType}</Badge></div>
            </div>
          </div>

          {/* Alerta de criticidade */}
          {hasHighImpacts && (
            <div className="flex items-start gap-2.5 rounded-lg bg-rose-600/10 border border-rose-500/20 p-3 text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong>Alerta Crítico:</strong> Esta alteração pode afetar registros obrigatórios ou de criticidade alta. Recomenda-se criar tarefas de revisão para os responsáveis correspondentes.
              </div>
            </div>
          )}

          {/* Listagem de registros afetados */}
          <div>
            <h4 className="font-semibold text-foreground mb-2">Registros Potencialmente Afetados</h4>
            {isLoading && <p className="text-xs text-muted-foreground animate-pulse">Simulando impactos corporativos...</p>}
            {!isLoading && (!simulatedImpacts || simulatedImpacts.length === 0) && (
              <p className="text-xs text-muted-foreground p-3 bg-muted/20 border border-dashed rounded text-center">Nenhum impacto de nível direto ou indireto detectado.</p>
            )}
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {simulatedImpacts?.map((imp) => {
                const key = `${imp.affectedEntityType}-${imp.affectedEntityId}`;
                const conf = itemsConfig[key] || {
                  requiresReview: false,
                  requiresTask: false,
                  responsibleUserId: '',
                  dueDate: '',
                  recommendedAction: '',
                };

                return (
                  <div key={key} className="rounded-lg border border-border bg-background p-3 shadow-sm space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">{imp.affectedEntityType}</Badge>
                          <span className="font-semibold text-foreground">{imp.affectedName}</span>
                          {imp.isMandatory && <Badge className="bg-rose-500 text-white text-[9px] px-1 py-0">Obrigatório</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Caminho: <span className="font-mono text-primary font-semibold">{imp.relationshipPath}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] uppercase ${
                        imp.impactLevel === 'CRITICAL' ? 'border-rose-400 text-rose-600 bg-rose-50/50' :
                        imp.impactLevel === 'HIGH' ? 'border-amber-400 text-amber-600 bg-amber-50/50' :
                        'border-border text-muted-foreground'
                      }`}>
                        {imp.impactLevel}
                      </Badge>
                    </div>

                    {/* Ações mitigadoras configuráveis pelo usuário */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-2.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Ação Recomendada de Revisão</label>
                        <Input
                          value={conf.recommendedAction}
                          onChange={(e) => setItemsConfig({
                            ...itemsConfig,
                            [key]: { ...conf, recommendedAction: e.target.value }
                          })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Responsável</label>
                          <select
                            value={conf.responsibleUserId}
                            onChange={(e) => setItemsConfig({
                              ...itemsConfig,
                              [key]: { ...conf, responsibleUserId: e.target.value }
                            })}
                            className="w-full h-7 rounded border bg-background px-2 text-xs"
                          >
                            <option value="">Sem atribuição</option>
                            {users?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Prazo Adequação</label>
                          <Input
                            type="date"
                            value={conf.dueDate}
                            onChange={(e) => setItemsConfig({
                              ...itemsConfig,
                              [key]: { ...conf, dueDate: e.target.value }
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 text-xs pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={conf.requiresReview}
                          onChange={(e) => setItemsConfig({
                            ...itemsConfig,
                            [key]: { ...conf, requiresReview: e.target.checked }
                          })}
                          className="rounded text-primary h-3.5 w-3.5"
                        />
                        Exige revisão documental
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={conf.requiresTask}
                          onChange={(e) => setItemsConfig({
                            ...itemsConfig,
                            [key]: { ...conf, requiresTask: e.target.checked }
                          })}
                          className="rounded text-primary h-3.5 w-3.5"
                        />
                        Criar plano de ação de adequação
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Justificativa obrigatoria */}
          <div className="space-y-1.5 border-t pt-3">
            <Label className="font-semibold text-rose-700">Justificativa da Alteração *</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva a justificativa para aprovação desta alteração no histórico e notificação dos responsáveis..."
              rows={3}
              required
            />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar Alteração</Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!justification.trim() || isLoading}
            className="gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" /> Confirmar e Salvar Alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
