'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Link2, RefreshCcw, Wrench } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { RecordEditor } from '@/components/database-admin/record-editor';
import { StructureOpDialog } from '@/components/database-admin/structure-op-dialog';
import type { TableSchema } from '@/components/database-admin/types';

export function TableDetailContent({ table, onBack }: { table: string; onBack?: () => void }) {
  const qc = useQueryClient();
  const [ddl, setDdl] = useState<{ op?: string } | null>(null);

  const schema = useQuery<TableSchema>({
    queryKey: ['db-admin', 'table-schema', table],
    queryFn: () => api<TableSchema>(`/admin/database/tables/${encodeURIComponent(table)}/schema`),
    refetchOnWindowFocus: false,
  });

  const data = schema.data;
  const catalog = data?.catalog ?? fallbackTableCatalog(table);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack ? (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Tabelas
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/database/tables">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Tabelas
              </Link>
            </Button>
          )}
          <div>
            <h2 className="font-mono text-lg font-semibold">{table}</h2>
            <p className="text-sm text-muted-foreground">Estrutura da tabela (colunas, constraints e índices).</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDdl({})} disabled={!data}>
            <Wrench className="mr-2 h-4 w-4" />
            Editar estrutura (DDL)
          </Button>
          <Button variant="outline" onClick={() => schema.refetch()} disabled={schema.isFetching}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', schema.isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {ddl && data && (
        <StructureOpDialog
          table={table}
          columns={data.columns}
          initialOperation={ddl.op}
          onClose={() => setDdl(null)}
          onDone={() => {
            setDdl(null);
            qc.invalidateQueries({ queryKey: ['db-admin', 'table-schema', table] });
            qc.invalidateQueries({ queryKey: ['db-admin', 'tables'] });
          }}
        />
      )}

      {schema.isLoading && <LoadingState label="Lendo estrutura..." />}
      {schema.isError && (
        <SectionCard title="Falha" description="Não foi possível ler a estrutura.">
          <div className="rounded-lg border border-status-red/30 bg-status-red/10 p-4 text-sm">{(schema.error as Error)?.message}</div>
        </SectionCard>
      )}

      {data && (
        <>
          <SectionCard title="Identificacao da tabela" description="Catalogo funcional usado pelo Portal Administrativo Global.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CatalogInfo label="Modulo" value={catalog.module} />
              <CatalogInfo label="Rotulo amigavel" value={catalog.label} />
              <CatalogInfo label="Origem" value={catalog.origin} />
              <CatalogInfo label="Impacto" value={catalog.impact} />
            </div>
            <div className="mt-4 rounded-md border bg-muted/20 p-3 text-sm">
              <div className="font-medium">O que faz</div>
              <p className="mt-1 text-muted-foreground">{catalog.purpose}</p>
            </div>
          </SectionCard>

          <SectionCard title="Colunas" description={`${data.columns.length} coluna(s).`} contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th className="text-left">#</th>
                    <th className="text-left">Coluna</th>
                    <th className="text-left">Tipo</th>
                    <th className="text-left">Nulo?</th>
                    <th className="text-left">Padrão</th>
                    <th className="text-left">Chave</th>
                  </tr>
                </thead>
                <tbody>
                  {data.columns.map((column) => (
                    <tr key={column.name}>
                      <td className="text-xs text-muted-foreground">{column.position}</td>
                      <td className="font-medium">{column.name}</td>
                      <td className="font-mono text-xs">
                        {column.dataType}
                        {column.maxLength ? `(${column.maxLength})` : ''}
                      </td>
                      <td>{column.nullable ? <span className="text-muted-foreground">sim</span> : <span className="text-status-red">não</span>}</td>
                      <td className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">{column.default ?? '-'}</td>
                      <td>
                        <div className="flex gap-1">
                          {column.isPrimaryKey && (
                            <Badge variant="outline" className="gap-1 border-status-yellow/40 text-status-yellow">
                              <KeyRound className="h-3 w-3" /> PK
                            </Badge>
                          )}
                          {column.isForeignKey && (
                            <Badge variant="outline" className="gap-1 border-status-blue/40 text-status-blue" title={column.references ? `${column.references.table}.${column.references.column}` : ''}>
                              <Link2 className="h-3 w-3" /> FK
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard title="Constraints" description={`${data.constraints.length} constraint(s).`} contentClassName="p-0">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th className="text-left">Nome</th>
                      <th className="text-left">Tipo</th>
                      <th className="text-left">Definicao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.constraints.map((constraint) => (
                      <tr key={constraint.name}>
                        <td className="font-mono text-xs">{constraint.name}</td>
                        <td><Badge variant="outline">{constraint.type}</Badge></td>
                        <td className="max-w-[320px] truncate font-mono text-xs text-muted-foreground" title={constraint.definition}>{constraint.definition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Índices" description={`${data.indexes.length} índice(s).`} contentClassName="p-0">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th className="text-left">Nome</th>
                      <th className="text-left">Colunas</th>
                      <th className="text-left">Unico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.indexes.map((index) => (
                      <tr key={index.name}>
                        <td className="font-mono text-xs">{index.name}</td>
                        <td className="font-mono text-xs">{index.columns.join(', ')}</td>
                        <td>{index.isUnique ? 'sim' : 'não'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Registros" description="Leitura paginada, inclusão, edição, duplicação e exclusão (individual e em massa) com retrato e auditoria.">
            <RecordEditor table={table} />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function CatalogInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function fallbackTableCatalog(table: string): TableSchema['catalog'] {
  return {
    module: 'Outras tabelas',
    moduleKey: 'other',
    label: humanizeTableName(table),
    origin: 'Schema public',
    purpose: 'Tabela fisica do banco sem classificacao especifica no catalogo retornado pela API.',
    impact: 'Pode impactar telas, relatorios, integracoes ou rotinas que dependam diretamente desses dados.',
  };
}

function humanizeTableName(table: string) {
  if (table.startsWith('_')) return table;
  return table
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}
