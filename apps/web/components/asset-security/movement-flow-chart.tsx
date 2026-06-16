'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/platform/empty-state';
import { movementFlowByDay } from '@/lib/asset-security/analytics';
import type { SecurityMovement } from '@/lib/asset-security/types';

/** Fluxo de entradas × saídas por dia (últimos 14 dias). */
export function MovementFlowChart({ movements }: { movements: SecurityMovement[] }) {
  const data = movementFlowByDay(movements);
  if (data.every((d) => d.entradas === 0 && d.saidas === 0)) {
    return <EmptyState title="Sem movimentações no período" description="Registre entradas e saídas para ver o fluxo." />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="entradas" name="Entradas" fill="#2563eb" radius={[2, 2, 0, 0]} />
        <Bar dataKey="saidas" name="Saídas" fill="#16a34a" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
