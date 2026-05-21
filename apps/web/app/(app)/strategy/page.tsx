'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Map, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface StrategicMap {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export default function StrategyPage() {
  const query = useQuery<StrategicMap[]>({
    queryKey: ['strategy', 'maps'],
    queryFn: () => api<StrategicMap[]>('/strategy/maps'),
  });

  return (
    <div>
      <PageHeader
        title="Mapa Estrategico (BSC)"
        description="Perspectivas, objetivos e relacoes de causa e efeito que conectam estrategia a execucao."
        actions={
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Novo mapa
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {query.data?.map((m) => (
          <Link key={m.id} href={`/strategy/${m.id}`}>
            <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Map className="h-5 w-5" />
                  </div>
                  {m.active && <Badge>Ativo</Badge>}
                </div>
                <div className="font-semibold">{m.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDate(m.startsAt)} - {formatDate(m.endsAt)}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!query.isLoading && query.data?.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum mapa estrategico cadastrado.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
