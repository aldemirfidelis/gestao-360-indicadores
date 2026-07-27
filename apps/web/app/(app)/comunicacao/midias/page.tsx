'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, FileText, Search, Trash2, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { CoverImage } from '@/components/communication/publication-bits';
import { FileUploadButton, ImageUploadButton } from '@/components/communication/media-uploader';
import { formatBytes, type MediaAsset } from '@/lib/communication/publications';

export default function BibliotecaMidiasPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['communication:media', 'communication:manage']);

  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [confirmDelete, setConfirmDelete] = useState<MediaAsset | null>(null);

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (folder) params.set('folder', folder);
  if (type) params.set('type', type);
  params.set('status', status);

  const library = useQuery<{ items: MediaAsset[]; folders: Array<{ name: string; count: number }> }>({
    queryKey: ['communication-media', params.toString()],
    queryFn: () => api(`/communication/media?${params.toString()}`),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['communication-media'] });
    void qc.invalidateQueries({ queryKey: ['communication-media-picker'] });
  };

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/communication/media/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => {
      toast.success('Mídia atualizada.');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/communication/media/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Mídia excluída.');
      setConfirmDelete(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = library.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comunicação"
        tone="view"
        title="Biblioteca de mídias"
        description="Imagens, banners e documentos reutilizáveis nas publicações internas."
        breadcrumbs={[{ label: 'Comunicação', href: '/comunicacao' }, { label: 'Biblioteca de mídias' }]}
        actions={
          canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <ImageUploadButton label="Enviar imagem" folder={folder || 'Geral'} onUploaded={invalidate} />
              <FileUploadButton label="Enviar documento" folder={folder || 'Geral'} onUploaded={invalidate} />
            </div>
          )
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <NativeSelect value={folder} onChange={(event) => setFolder(event.target.value)}>
            <option value="">Todas as pastas</option>
            {(library.data?.folders ?? []).map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} ({item.count})
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="IMAGE">Imagem</option>
            <option value="BANNER">Banner</option>
            <option value="VIDEO">Vídeo</option>
            <option value="PDF">PDF</option>
            <option value="DOCUMENT">Documento</option>
          </NativeSelect>
          <NativeSelect value={status} onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'ARCHIVED')}>
            <option value="ACTIVE">Ativas</option>
            <option value="ARCHIVED">Arquivadas</option>
          </NativeSelect>
        </CardContent>
      </Card>

      {library.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/50 px-4 py-12 text-center text-sm text-muted-foreground">
          Nenhuma mídia nesta pasta.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              {item.type === 'IMAGE' || item.type === 'BANNER' ? (
                <CoverImage url={item.url} alt={item.name} aspect="aspect-[16/10]" />
              ) : (
                <div className="grid aspect-[16/10] place-items-center bg-muted/60 text-muted-foreground">
                  <FileText className="h-7 w-7 opacity-60" />
                </div>
              )}
              <CardContent className="space-y-2 p-3">
                <p className="truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {item.type} · {formatBytes(item.sizeBytes)}
                  {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {item.folder ?? 'Sem pasta'} · {formatDate(item.createdAt)}
                </p>
                {item.ratioWarning && (
                  <p className="flex items-start gap-1.5 rounded border border-amber-300/60 bg-amber-500/8 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                    <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
                    {item.ratioWarning}
                  </p>
                )}
                <div className="flex items-center justify-between border-t pt-2">
                  <span
                    className={cn(
                      'text-[11px]',
                      item.usageCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                    )}
                  >
                    {item.usageCount > 0 ? `Em uso em ${item.usageCount}` : 'Sem uso'}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        title={item.status === 'ARCHIVED' ? 'Reativar' : 'Arquivar'}
                        onClick={() =>
                          update.mutate({ id: item.id, body: { status: item.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED' } })
                        }
                      >
                        {item.status === 'ARCHIVED' ? (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        title="Excluir"
                        onClick={() => setConfirmDelete(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Excluir mídia"
        description={`"${confirmDelete?.name ?? ''}" será removida da biblioteca. Mídias em uso em publicações não podem ser excluídas — arquive-as.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (confirmDelete) await remove.mutateAsync(confirmDelete.id);
        }}
      />
    </div>
  );
}
