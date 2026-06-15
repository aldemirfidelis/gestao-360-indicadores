'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Download, FileUp, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/platform/empty-state';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/compensation/format';

const JOB_TYPES = ['administrativo', 'operacional', 'tecnico', 'especialista', 'lideranca', 'gestao', 'executivo'];

// Mapeamento de cabeçalhos aceitos (PT/EN) -> campo do cargo.
const HEADER_ALIASES: Record<string, string> = {
  name: 'name', nome: 'name', cargo: 'name',
  family: 'family', familia: 'family',
  grade: 'grade',
  salaryband: 'salaryBand', faixa: 'salaryBand', banda: 'salaryBand',
  jobtype: 'jobType', tipo: 'jobType',
  summary: 'summary', resumo: 'summary', descricao: 'summary',
};

interface ParsedRow {
  name: string;
  family?: string;
  grade?: string;
  salaryBand?: string;
  jobType: string;
  summary?: string;
  error: string | null;
}

function normalizeRow(raw: Record<string, unknown>): ParsedRow {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_ALIASES[key.trim().toLowerCase()];
    if (field && value != null && String(value).trim()) mapped[field] = String(value).trim();
  }
  const jobType = mapped.jobType ? mapped.jobType.toLowerCase() : 'administrativo';
  const row: ParsedRow = {
    name: mapped.name ?? '',
    family: mapped.family,
    grade: mapped.grade,
    salaryBand: mapped.salaryBand,
    jobType: JOB_TYPES.includes(jobType) ? jobType : 'administrativo',
    summary: mapped.summary,
    error: null,
  };
  if (!row.name) row.error = 'Nome do cargo é obrigatório';
  return row;
}

export function ImportJobsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  function reset() {
    setRows([]);
    setFileName('');
    setImporting(false);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    try {
      if (/\.xlsx?$/i.test(file.name)) {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const parsed = json.map(normalizeRow);
        setRows(parsed);
        if (parsed.length === 0) toast.error('Nenhuma linha encontrada na planilha');
        return;
      }
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (res) => {
          const parsed = (res.data ?? []).map(normalizeRow);
          setRows(parsed);
          if (parsed.length === 0) toast.error('Nenhuma linha encontrada no CSV');
        },
        error: (err) => toast.error(`Falha ao ler CSV: ${err.message}`),
      });
    } catch (err: any) {
      toast.error(`Falha ao ler arquivo: ${err?.message ?? 'formato inválido'}`);
    }
  }

  function downloadTemplate() {
    downloadCsv('modelo-cargos.csv', [
      ['nome', 'familia', 'grade', 'faixa', 'tipo', 'resumo'],
      ['Analista de RH', 'Recursos Humanos', 'III', 'B', 'administrativo', 'Apoio aos processos de RH'],
    ]);
  }

  const valid = rows.filter((r) => !r.error);

  async function runImport() {
    setImporting(true);
    let created = 0;
    let failed = 0;
    for (const row of valid) {
      try {
        await api('/cargos-salarios/jobs', {
          method: 'POST',
          json: { name: row.name, family: row.family, grade: row.grade, salaryBand: row.salaryBand, jobType: row.jobType, summary: row.summary },
        });
        created += 1;
      } catch {
        failed += 1;
      }
    }
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['compensation', 'jobs'] });
    qc.invalidateQueries({ queryKey: ['compensation', 'options'] });
    if (created) toast.success(`${created} cargo(s) importado(s)${failed ? `, ${failed} com falha` : ''}`);
    else toast.error('Nenhum cargo importado');
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar cargos via CSV/XLSX</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-1.5 h-4 w-4" /> Escolher arquivo
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1.5 h-4 w-4" /> Baixar modelo
          </Button>
          {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            className="mt-2"
            title="Selecione um CSV ou XLSX"
            description="Colunas aceitas: nome (obrigatório), familia, grade, faixa, tipo, resumo. Baixe o modelo para o formato correto."
          />
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default">{valid.length} válidos</Badge>
              {rows.length - valid.length > 0 && <Badge variant="destructive">{rows.length - valid.length} com erro</Badge>}
            </div>
            <div className="max-h-[360px] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-card text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Cargo</th>
                    <th className="px-3 py-2 text-left">Família</th>
                    <th className="px-3 py-2 text-left">Grade/Faixa</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/60">
                      <td className="px-3 py-2 font-medium">{row.name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2">{row.family ?? '-'}</td>
                      <td className="px-3 py-2">{[row.grade, row.salaryBand].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="px-3 py-2">{row.jobType}</td>
                      <td className="px-3 py-2">
                        {row.error ? <span className="text-status-red">{row.error}</span> : <span className="text-status-green">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t pt-4">
              <Button onClick={runImport} disabled={valid.length === 0 || importing}>
                <Upload className="mr-1.5 h-4 w-4" /> Importar {valid.length} cargo(s)
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
