'use client';

import { PhasePlaceholder } from '@/components/database-admin/phase-placeholder';

export default function ImportExportPage() {
  return (
    <PhasePlaceholder
      title="Importar e Exportar"
      phase="Fase F"
      items={[
        'Exportar tabela, registros filtrados, estrutura ou resultado de consulta',
        'Formatos CSV, Excel, JSON e SQL',
        'Importar CSV/JSON com prévia, mapeamento de colunas e validação de tipos',
        'Estratégias (inserir, atualizar, ignorar, substituir), transação e snapshot',
      ]}
    />
  );
}
