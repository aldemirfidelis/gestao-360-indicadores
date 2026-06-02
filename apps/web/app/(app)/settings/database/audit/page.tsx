'use client';

import { PhasePlaceholder } from '@/components/database-admin/phase-placeholder';

export default function DbAuditPage() {
  return (
    <PhasePlaceholder
      title="Auditoria administrativa"
      phase="Fase G"
      items={[
        'Histórico de todas as ações do módulo (acesso, leitura, escrita, DDL, export/import)',
        'Filtros por período, usuário, tabela, tipo de ação e sucesso/falha + busca textual',
        'Detalhe da alteração (valor anterior/novo, SQL quando permitido, transação)',
        'Exportação e paginação. Sem exclusão silenciosa de auditoria.',
      ]}
    />
  );
}
