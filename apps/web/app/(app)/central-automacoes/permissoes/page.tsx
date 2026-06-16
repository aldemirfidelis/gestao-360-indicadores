'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/platform/section-card';
import {
  FolderLock,
  Save,
  Check,
  X,
  ShieldAlert,
  Sliders,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

interface RolePermissions {
  role: string;
  label: string;
  desc: string;
  view: boolean;
  manage: boolean;
  publish: boolean;
  execute: boolean;
  approve: boolean;
}

export default function PermissionsMatrixPage() {
  const [roles, setRoles] = useState<RolePermissions[]>([
    {
      role: 'GESTOR',
      label: 'Gestor de Área',
      desc: 'Administradores locais do setor, criam fluxos locais e supervisionam desvios.',
      view: true,
      manage: true,
      publish: true,
      execute: true,
      approve: true,
    },
    {
      role: 'USUARIO',
      label: 'Colaborador (Usuário)',
      desc: 'Usuários operacionais do sistema. Podem executar tarefas humanas e aprovações delegadas.',
      view: true,
      manage: false,
      publish: false,
      execute: true,
      approve: true,
    },
    {
      role: 'VISUALIZADOR',
      label: 'Auditores (Leitura)',
      desc: 'Perfis de leitura rápida e auditorias. Apenas acompanham registros sem interações.',
      view: true,
      manage: false,
      publish: false,
      execute: false,
      approve: false,
    },
  ]);

  const togglePermission = (roleName: string, perm: 'view' | 'manage' | 'publish' | 'execute' | 'approve') => {
    setRoles(prev =>
      prev.map(r => (r.role === roleName ? { ...r, [perm]: !r[perm] } : r))
    );
  };

  const handleSave = () => {
    toast.success('Matriz de acessos e permissões atualizada!');
  };

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
      <PageHeader
        eyebrow="Central de Automações"
        title="Ajuste Fino de Permissões"
        description="Regule os direitos e privilégios de acesso por papel organizacional para a Central de Automações, design e liberação de fluxos."
      />

      <div className="max-w-4xl space-y-6 overflow-y-auto pr-1 flex-1">
        {/* RBAC Matrix Card */}
        <SectionCard title="Matriz de Papéis & Ações" description="Clique nos checkboxes para regular permissões de cada perfil.">
          <div className="border rounded-xl overflow-hidden bg-card divide-y">
            {/* Header row */}
            <div className="grid grid-cols-[1.5fr,1fr,1fr,1fr,1fr,1fr] bg-muted/10 p-3.5 text-[10px] font-bold text-muted-foreground uppercase text-center items-center">
              <div className="text-left pl-2">Perfil / Função</div>
              <div>Visualizar</div>
              <div>Construir</div>
              <div>Publicar</div>
              <div>Executar</div>
              <div>Aprovar</div>
            </div>

            {/* Matrix rows */}
            {roles.map((item) => (
              <div
                key={item.role}
                className="grid grid-cols-[1.5fr,1fr,1fr,1fr,1fr,1fr] p-4 text-center items-center text-xs hover:bg-muted/10 transition-colors"
              >
                <div className="text-left space-y-0.5 pl-2">
                  <span className="font-bold text-foreground block">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-normal block max-w-sm">
                    {item.desc}
                  </span>
                </div>

                {/* View */}
                <div>
                  <button
                    onClick={() => togglePermission(item.role, 'view')}
                    className={`h-5 w-5 rounded border mx-auto flex items-center justify-center transition-all ${
                      item.view ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {item.view && <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Manage */}
                <div>
                  <button
                    onClick={() => togglePermission(item.role, 'manage')}
                    className={`h-5 w-5 rounded border mx-auto flex items-center justify-center transition-all ${
                      item.manage ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {item.manage && <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Publish */}
                <div>
                  <button
                    onClick={() => togglePermission(item.role, 'publish')}
                    className={`h-5 w-5 rounded border mx-auto flex items-center justify-center transition-all ${
                      item.publish ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {item.publish && <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Execute */}
                <div>
                  <button
                    onClick={() => togglePermission(item.role, 'execute')}
                    className={`h-5 w-5 rounded border mx-auto flex items-center justify-center transition-all ${
                      item.execute ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {item.execute && <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Approve */}
                <div>
                  <button
                    onClick={() => togglePermission(item.role, 'approve')}
                    className={`h-5 w-5 rounded border mx-auto flex items-center justify-center transition-all ${
                      item.approve ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {item.approve && <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Global safety advice */}
        <div className="p-4 rounded-xl border bg-status-yellow/5 border-status-yellow/15 flex gap-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldAlert className="h-5 w-5 text-status-yellow shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="text-foreground">Importante: Regra de Herança Multiempresa</strong>
            <p className="text-[11px]">
              O isolamento no nível de banco de dados (`companyId`) precede qualquer alteração nessa matriz. Administradores globais e usuários qualificados só terão acesso aos fluxos de trabalho cadastrados sob a sua empresa ativa, mesmo com todas as opções ativas.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" className="h-9 text-xs">
            Descartar
          </Button>
          <Button className="h-9 text-xs flex items-center gap-1.5" onClick={handleSave}>
            <Save className="h-4 w-4" />
            Salvar Matriz
          </Button>
        </div>
      </div>
    </div>
  );
}
