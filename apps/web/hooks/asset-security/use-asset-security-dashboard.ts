import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AnyRecord,
  AssistantInsightsResponse,
  SecurityMovement,
  SecurityOptions,
  SecuritySummary,
} from '@/lib/asset-security/types';

interface UseAssetSecurityDashboardParams {
  canManage: boolean;
  search: string;
  tab: string;
}

export function useAssetSecurityDashboard({ canManage, search, tab }: UseAssetSecurityDashboardParams) {
  const queryClient = useQueryClient();

  const summary = useQuery<SecuritySummary>({
    queryKey: ['asset-security', 'summary'],
    queryFn: () => api('/asset-security/summary'),
  });
  const options = useQuery<SecurityOptions>({
    queryKey: ['asset-security', 'options'],
    queryFn: () => api('/asset-security/options'),
  });
  const gates = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'gates'],
    queryFn: () => api('/asset-security/gates'),
  });
  const posts = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'posts'],
    queryFn: () => api('/asset-security/posts'),
  });
  const people = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'people', search],
    queryFn: () => api(`/asset-security/people${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
  const vehicles = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'vehicles', search],
    queryFn: () => api(`/asset-security/vehicles${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
  const authorizations = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'authorizations'],
    queryFn: () => api('/asset-security/authorizations'),
  });
  const present = useQuery<SecurityMovement[]>({
    queryKey: ['asset-security', 'present'],
    queryFn: () => api('/asset-security/present?take=300'),
    refetchInterval: tab === 'operation' ? 30_000 : false,
  });
  const pending = useQuery<SecurityMovement[]>({
    queryKey: ['asset-security', 'pending-exits'],
    queryFn: () => api('/asset-security/pending-exits?take=300'),
  });
  const movements = useQuery<SecurityMovement[]>({
    queryKey: ['asset-security', 'movements'],
    queryFn: () => api('/asset-security/movements?take=400'),
  });
  const incidents = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'incidents'],
    queryFn: () => api('/asset-security/incidents?take=200'),
  });
  const roundExecutions = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'round-executions'],
    queryFn: () => api('/asset-security/round-executions?take=200'),
  });
  const custody = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'custody'],
    queryFn: () => api('/asset-security/custody-items'),
  });
  const materials = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'materials'],
    queryFn: () => api('/asset-security/materials'),
  });
  const logbook = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'logbook'],
    queryFn: () => api('/asset-security/logbook'),
  });
  const insights = useQuery<AssistantInsightsResponse>({
    queryKey: ['asset-security', 'assistant-insights'],
    queryFn: () => api('/asset-security/assistant-insights'),
  });
  const packageConfig = useQuery<AnyRecord>({
    queryKey: ['asset-security', 'package'],
    queryFn: () => api('/asset-security/package'),
    enabled: canManage,
  });

  const invalidateAssetSecurity = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['asset-security'] });
  }, [queryClient]);

  return {
    summary,
    options,
    gates,
    posts,
    people,
    vehicles,
    authorizations,
    present,
    pending,
    movements,
    incidents,
    roundExecutions,
    custody,
    materials,
    logbook,
    insights,
    packageConfig,
    invalidateAssetSecurity,
  };
}
