'use client';

import type { ChangeEvent } from 'react';
import { Download, FileText, FileUp, Trash2 } from 'lucide-react';
import { DOC_KIND, labelOf } from '@/lib/recruitment/labels';
import type { Application, CandidateDocument } from '@/lib/candidate/types';
import { Button, Card, CardTitle, EmptyState, Select, formatBytes, formatDate } from './ui';

/**
 * Biblioteca de arquivos do candidato: currículo, certificados, portfólio.
 * O mesmo arquivo pode ser reaproveitado em qualquer candidatura.
 */
export function DocumentsSection({
  documents,
  applications,
  file,
  uploadForm,
  busy,
  onPickFile,
  onUploadFormChange,
  onUpload,
  onDownload,
  onDelete,
}: {
  documents: CandidateDocument[];
  applications: Application[];
  file: File | null;
  uploadForm: { kind: string; applicationId: string };
  busy: boolean;
  onPickFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadFormChange: (patch: Partial<{ kind: string; applicationId: string }>) => void;
  onUpload: () => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const hasCv = documents.some((doc) => doc.kind === 'CV');

  return (
    <div className="space-y-5">
      {!hasCv && (
        <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Você ainda não enviou um currículo.</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            As empresas usam o currículo logo na primeira triagem. Envie o seu abaixo.
          </p>
        </Card>
      )}

      <Card>
        <CardTitle title="Enviar arquivo" hint="PDF, DOC ou DOCX para currículo. Certificados também aceitam PNG e JPG. Até 8 MB." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Tipo de documento" value={uploadForm.kind} onChange={(kind) => onUploadFormChange({ kind })}>
            <option value="CV">Currículo</option>
            <option value="COVER">Carta de apresentação</option>
            <option value="CERTIFICATE">Certificado</option>
            <option value="PORTFOLIO">Portfólio</option>
            <option value="OTHER">Outro</option>
          </Select>
          <Select label="Vincular a" value={uploadForm.applicationId} onChange={(applicationId) => onUploadFormChange({ applicationId })}>
            <option value="">Perfil geral (vale para todas)</option>
            {applications.map((app) => <option key={app.id} value={app.id}>{app.posting.title}</option>)}
          </Select>
        </div>

        <label
          className={`mt-4 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300 ${
            busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <FileUp className="h-5 w-5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate">{file ? `${file.name} (${formatBytes(file.size)})` : 'Escolher arquivo no seu computador'}</span>
          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" disabled={busy} onChange={onPickFile} />
        </label>

        <Button onClick={onUpload} disabled={busy || !file} className="mt-4 w-full sm:w-auto">
          Enviar documento
        </Button>
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardTitle title="Seus documentos" hint={documents.length > 0 ? `${documents.length} ${documents.length === 1 ? 'arquivo' : 'arquivos'}.` : undefined} />
        </div>
        {documents.length === 0 ? (
          <div className="p-5 pt-0 sm:p-6 sm:pt-0">
            <EmptyState icon={<FileText className="h-8 w-8" />} title="Nenhum documento enviado" description="O que você enviar aqui pode ser reaproveitado em qualquer candidatura." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                  <FileText className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{doc.fileName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {labelOf(DOC_KIND, doc.kind)} · {formatBytes(doc.sizeBytes)} · enviado em {formatDate(doc.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => onDownload(doc.id)}
                  title="Baixar"
                  aria-label={`Baixar ${doc.fileName}`}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(doc.id)}
                  title="Remover"
                  aria-label={`Remover ${doc.fileName}`}
                  className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
