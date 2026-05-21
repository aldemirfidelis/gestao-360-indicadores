'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

const ACTION_PILL: Record<string, string> = {
  LOGIN: 'pill-blue',
  CREATE: 'pill-green',
  UPDATE: 'pill-yellow',
  DELETE: 'pill-red',
};

export default function AuditPage() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');

  const query = useQuery<AuditEntry[]>({
    queryKey: ['audit', entity, action],
    queryFn: () => {
      const params = new URLSearchParams();
      if (entity) params.set('entity', entity);
      if (action) params.set('action', action);
      params.set('limit', '200');
      return api<AuditEntry[]>(`/audit?${params.toString()}`);
    },
  });

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Rastro de quem fez o que e quando. Login, criacoes, atualizacoes e exclusoes."
      />

      <Card className="mb-6">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Filtrar por entidade (ex.: Indicator, Deviation)..."
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
          />
          <NativeSelect value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Todas as acoes</option>
            <option value="LOGIN">LOGIN</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </NativeSelect>
          <div className="text-sm text-muted-foreground self-center">
            {query.data?.length ?? 0} registro(s)
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left w-40">Quando</th>
                <th className="px-4 py-2 text-left">Usuario</th>
                <th className="px-4 py-2 text-left">Acao</th>
                <th className="px-4 py-2 text-left">Entidade</th>
                <th className="px-4 py-2 text-left">IP / agente</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-2">
                    {e.user ? (
                      <div>
                        <div className="font-medium">{e.user.name}</div>
                        <div className="text-xs text-muted-foreground">{e.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`pill ${ACTION_PILL[e.action] ?? 'pill-gray'}`}>{e.action}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <Badge variant="outline" className="w-fit">{e.entity}</Badge>
                      {e.entityId && (
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">
                          {e.entityId}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    <div>{e.ip ?? '—'}</div>
                    <div className="truncate max-w-[280px]">{e.userAgent ?? ''}</div>
                  </td>
                </tr>
              ))}
              {query.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!query.isLoading && (query.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
