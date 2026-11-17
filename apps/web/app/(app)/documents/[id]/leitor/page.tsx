'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Lock, Minus, Plus, Printer } from 'lucide-react';
import type { DocNode } from '@g360/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { StructuredViewer } from '@/components/documents/structured-editor';
import { STATUS_LABEL, type Confidentiality, type ContentFormat, type DocStatus } from '@/components/documents/types';
import { ConfidentialityBadge, EmptyState, errorMessage, invalidateDocuments } from '@/components/documents/ui';
import { fetchProtectedBlob } from '@/components/documents/files';

const PdfViewer = dynamic(() => import('@/components/documents/pdf-viewer'), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">Carregando PDF…</div>,
});

interface ReaderData {
  id: string;
  code: string | null;
  number: number;
  title: string;
  description: string | null;
  status: DocStatus;
  confidentiality: Confidentiality;
  contentFormat: ContentFormat;
  typeConfig: { sigla: string; name: string } | null;
  orgNode: { name: string } | null;
  owner: { name: string } | null;
  validUntil: string | null;
  publishedAt: string | null;
  current: boolean;
  version: { id: string; label: string; publicationDate: string | null; changeSummary: string | null; pdfFileId: string | null };
  contentJson: DocNode | null;
  bodyText: string | null;
  readRequired: boolean;
  myRead: { status: string; dueAt: string | null; confirmedAt: string | null } | null;
}

const SIZES = ['text-[15px]', 'text-[17px]', 'text-[19px]', 'text-[22px]'];

function OfficialPdf({ id, fileName }: { id: string; fileName: string }) {
  const pdf = useQuery({ queryKey: ['documents', id, 'reader-pdf'], queryFn: () => fetchProtectedBlob(`/documents/${id}/official-pdf?inline=1`), staleTime: 5 * 60_000 });
  if (pdf.isLoading) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando PDF…</div>;
  if (pdf.isError || !pdf.data) return <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Não foi possível abrir o PDF" description={errorMessage(pdf.error)} />;
  return <PdfViewer src={pdf.data} fileName={fileName} className="h-[78vh] min-h-[420px]" />;
}

export default function DocumentReaderPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [size, setSize] = useState(1);
  const reader = useQuery<ReaderData>({ queryKey: ['documents', id, 'reader'], queryFn: () => api<ReaderData>(`/documents/${id}/reader`), enabled: Boolean(id) });
  const confirm = useMutation({
    mutationFn: () => api(`/documents/${id}/read`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Leitura confirmada. Obrigado!');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (reader.isLoading) return <div className="mx-auto max-w-3xl space-y-3 py-6"><div className="h-20 animate-pulse rounded-xl bg-muted/40" /><div className="h-96 animate-pulse rounded-xl bg-muted/30" /></div>;
  if (reader.isError || !reader.data) {
    return (
      <EmptyState
        className="mx-auto mt-10 max-w-lg"
        icon={<Lock className="h-5 w-5" />}
        title="Documento indisponível"
        description={errorMessage(reader.error, 'O documento não tem revisão vigente ou você não tem acesso.')}
        action={<Button size="sm" variant="outline" asChild><Link href="/documents">Ir para Documentos</Link></Button>}
      />
    );
  }

  const data = reader.data;
  const code = data.code ?? `#${data.number}`;
  const pending = data.myRead?.status === 'PENDING';
  const confirmed = data.myRead?.status === 'CONFIRMED' || data.myRead?.status === 'READ' || confirm.isSuccess;

  return (
    <div className="mx-auto max-w-4xl pb-56 lg:pb-28">
      <div className="mb-3 flex items-center justify-between gap-2 print:hidden">
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/documents/${data.id}`}><ArrowLeft className="mr-1.5 h-4 w-4" />Ficha do documento</Link>
        </Button>
        <div className="flex items-center gap-1">
          {data.contentJson && (
            <>
              <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Diminuir letra" disabled={size === 0} onClick={() => setSize((value) => Math.max(0, value - 1))}><Minus className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Aumentar letra" disabled={size === SIZES.length - 1} onClick={() => setSize((value) => Math.min(SIZES.length - 1, value + 1))}><Plus className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Imprimir" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </div>

      <header className="rounded-xl border bg-card px-5 py-4">
        <p className="font-mono text-sm font-semibold text-primary">{code} · {data.version.label}</p>
        <h1 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">{data.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.typeConfig?.name ?? ''}
          {data.orgNode ? ` · ${data.orgNode.name}` : ''}
          {data.version.publicationDate ? ` · vigente desde ${formatDate(data.version.publicationDate)}` : ''}
          {data.validUntil ? ` · válido até ${formatDate(data.validUntil)}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ConfidentialityBadge level={data.confidentiality} />
          {!data.current && (
            <span className="flex items-center gap-1 rounded-md border border-status-yellow/40 bg-status-yellow/5 px-2 py-0.5 text-xs font-medium text-status-yellow">
              <AlertTriangle className="h-3.5 w-3.5" /> {STATUS_LABEL[data.status]} · ainda não vigente
            </span>
          )}
        </div>
        {data.version.changeSummary && data.current && (
          <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que mudou nesta revisão</p>
            <p className="mt-0.5 whitespace-pre-wrap">{data.version.changeSummary}</p>
          </div>
        )}
      </header>

      <main className="mt-4">
        {data.contentJson ? (
          <article className={`rounded-xl border bg-card px-5 py-4 sm:px-8 ${SIZES[size]}`}>
            <StructuredViewer value={data.contentJson} reader />
          </article>
        ) : data.version.pdfFileId ? (
          <OfficialPdf id={data.id} fileName={`${code}.pdf`} />
        ) : data.bodyText ? (
          <article className="whitespace-pre-wrap rounded-xl border bg-card px-5 py-4 text-base leading-relaxed">{data.bodyText}</article>
        ) : (
          <EmptyState title="Sem conteúdo para leitura." />
        )}
      </main>

      {data.readRequired && data.current && (pending || confirmed) && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 px-4 py-3 backdrop-blur print:hidden lg:bottom-0">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
            {confirmed ? (
              <p className="flex items-center gap-2 text-sm font-medium text-status-green">
                <CheckCircle2 className="h-5 w-5" />
                Leitura confirmada{data.myRead?.confirmedAt ? ` em ${formatDate(data.myRead.confirmedAt)}` : ''}.
              </p>
            ) : (
              <>
                <p className="text-center text-sm sm:text-left">
                  <strong>Leitura obrigatória.</strong> {data.myRead?.dueAt ? `Prazo ${formatDate(data.myRead.dueAt)}.` : ''} Leia até o fim e confirme.
                </p>
                <Button size="lg" className="w-full sm:w-auto" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
                  {confirm.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  Li e entendi
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
