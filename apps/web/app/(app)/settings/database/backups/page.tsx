'use client';

import { PhasePlaceholder } from '@/components/database-admin/phase-placeholder';

export default function BackupsPage() {
  return (
    <PhasePlaceholder
      title="Backup e Restauração"
      phase="Fase G"
      items={[
        'Criar backup lógico manual e listar snapshots (com tamanho, origem e checksum)',
        'Snapshot automático gerado antes de operações destrutivas (rollback por operação)',
        'Baixar, marcar como importante, validar integridade e restaurar logicamente',
        'Backup/restore de banco inteiro: orientação via Neon branching/PITR (não destrutivo na tela)',
      ]}
    />
  );
}
