'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface Company {
  id: string;
  name: string;
  tradeName: string | null;
  cnpj: string | null;
  branches: { id: string; name: string; city: string | null; state: string | null }[];
}

export default function SettingsPage() {
  const query = useQuery<Company | null>({
    queryKey: ['company', 'me'],
    queryFn: () => api<Company | null>('/companies/me'),
  });
  const c = query.data;

  return (
    <div>
      <PageHeader title="Configuracoes" description="Empresa, filiais e parametros gerais." />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Razao social</div>
            <div className="font-medium">{c?.name ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Nome fantasia</div>
            <div className="font-medium">{c?.tradeName ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">CNPJ</div>
            <div className="font-medium">{c?.cnpj ?? '—'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filiais ({c?.branches.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {c?.branches.map((b) => (
            <div key={b.id} className="rounded-lg border p-3">
              <div className="font-medium">{b.name}</div>
              <div className="text-xs text-muted-foreground">
                {b.city ?? '—'}/{b.state ?? '—'}
              </div>
              <Badge variant="outline" className="mt-2">{b.id.slice(0, 8)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
