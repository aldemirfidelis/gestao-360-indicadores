'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  jobTitle: string | null;
  active: boolean;
  lastLoginAt: string | null;
  defaultNode: { id: string; name: string } | null;
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Admin',
  DIRECTOR: 'Diretoria',
  MANAGER: 'Gestor',
  ANALYST: 'Analista',
  COLLABORATOR: 'Colaborador',
  VIEWER: 'Visitante',
};

export default function UsersPage() {
  const query = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/users'),
  });

  return (
    <div>
      <PageHeader title="Usuarios" description="Equipe vinculada a esta empresa." />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Perfil</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Ultimo acesso</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((u) => (
                <tr key={u.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">{u.jobTitle ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">{u.defaultNode?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">{formatDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="pill pill-green">Ativo</span>
                    ) : (
                      <span className="pill pill-gray">Inativo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
