'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/platform/empty-state';
import { incidentsBySeverity } from '@/lib/asset-security/analytics';
import type { AnyRecord } from '@/lib/asset-security/types';

/** Ocorrências por severidade (cor proporcional à criticidade). */
export function IncidentBreakdownChart({ incidents }: { incidents: AnyRecord[] }) {
  const data = useMemo(() => incidentsBySeverity(incidents), [incidents]);
  if (!data.length) {
    return <EmptyState title="Nenhuma ocorrência" description="Sem ocorrências registradas no momento." />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" name="Ocorrências" radius={[2, 2, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
