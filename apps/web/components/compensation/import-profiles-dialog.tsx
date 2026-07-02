'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileUp, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/platform/empty-state';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/compensation/format';

// Cabecalhos aceitos (PT/EN) -> campo do perfil do colaborador.
const HEADER_ALIASES: Record<string, string> = {
  matricula: 'registrationId', matrícula: 'registrationId', registrationid: 'registrationId', registro: 'registrationId',
  nome: 'employeeName', colaborador: 'employeeName', name: 'employeeName', employeename: 'employeeName',
  genero: 'gender', gênero: 'gender', gender: 'gender', sexo: 'gender',
  raca: 'raceEthnicity', 'raça': 'raceEthnicity', 'raca/cor': 'raceEthnicity', 'raça/cor': 'raceEthnicity', raceethnicity: 'raceEthnicity', cor: 'raceEthnicity',
  admissao: 'admissionDate', admissão: 'admissionDate', 'data de admissao': 'admissionDate', 'data de admissão': 'admissionDate', admissiondate: 'admissionDate',
  rating: 'performanceRating', desempenho: 'performanceRating', avaliacao: 'performanceRating', avaliação: 'performanceRating', performancerating: 'performanceRating', nota: 'performanceRating',
  ciclo: 'performanceCycleRef', performancecycleref: 'performanceCycleRef', 'ciclo da avaliacao': 'performanceCycleRef', 'ciclo da avaliação': 'performanceCycleRef',
};

interface ParsedRow {
  registrationId?: string;
  employeeName?: string;
  gender?: string;
  raceEthnicity?: string;
  admissionDate?: string;
  performanceRating?: string;
  performanceCycleRef?: string;
  error: string | null;
}

function normalizeRow(raw: Record<string, unknown>): ParsedRow {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_ALIASES[key.trim().toLowerCase()];
    if (field && value != null && String(value).trim()) mapped[field] = String(value).trim();
  }
  const row: ParsedRow = { ...mapped, error: null };
  if (!row.registrationId && !row.employeeName) row.error = 'Informe matrícula ou nome do colaborador';
  else if (row.performanceRating && !/^[1-4]$/.test(row.performanceRating)) row.error = 'Rating deve ser 1 a 4';
  return row;
}

/**
 * Import em lote de perfis dos colaboradores (genero, raca/cor, admissao e
 * rating de desempenho) via CSV/XLSX. Alimenta a equidade salarial
 * (Lei 14.611) e a distribuicao real da matriz de merito.
 */
export function ImportProfilesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const parsed = json.map(normalizeRow);
        setRows(parsed);
        if (parsed.length === 0) toast.error('Nenhuma linha encontrada na planilha');
        return;
      }
      const Papa = (await import('papaparse')).default;
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
    downloadCsv('modelo-perfis-colaboradores.csv', [
      ['matricula', 'nome', 'genero', 'raca/cor', 'admissao', 'rating', 'ciclo'],
      ['00123', 'Maria da Silva', 'FEMININO', 'Parda', '2021-03-15', '3', '2026'],
      ['00456', 'João Souza', 'MASCULINO', '', '2019-08-01', '2', '2026'],
    ]);
  }

  const valid = rows.filter((r) => !r.error);

  async function runImport() {
    setImporting(true);
    try {
      const result = await api<{ updated: number; errors: Array<{ row: number; message: string }>; total: number }>(
        '/cargos-salarios/employees/profile-import',
        { method: 'POST', json: { rows: valid.map(({ error: _error, ...row }) => row) } },
      );
      qc.invalidateQueries({ queryKey: ['compensation', 'enquadramento'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'equidade'] });
      if (result.updated) toast.success(`${result.updated} perfil(is) atualizado(s)${result.errors.length ? `, ${result.errors.length} com falha` : ''}`);
      else toast.error('Nenhum perfil importado');
      if (result.errors.length) {
        toast.message('Linhas com falha', { description: result.errors.slice(0, 5).map((e) => `Linha ${e.row}: ${e.message}`).join(' · ') });
      }
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Falha na importação');
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar perfis (gênero, admissão e desempenho)</DialogTitle>
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
            description="Colunas aceitas: matrícula ou nome (obrigatório), gênero (F/M/FEMININO/MASCULINO/NÃO-BINÁRIO), raça/cor, admissão (AAAA-MM-DD), rating (1 a 4), ciclo."
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
                    <th className="px-3 py-2 text-left">Matrícula</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Gênero</th>
                    <th className="px-3 py-2 text-left">Admissão</th>
                    <th className="px-3 py-2 text-left">Rating</th>
                    <th className="px-3 py-2 text-left">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/60">
                      <td className="px-3 py-2 font-mono text-xs">{row.registrationId ?? '-'}</td>
                      <td className="px-3 py-2">{row.employeeName ?? '-'}</td>
                      <td className="px-3 py-2">{row.gender ?? '-'}</td>
                      <td className="px-3 py-2">{row.admissionDate ?? '-'}</td>
                      <td className="px-3 py-2">{row.performanceRating ?? '-'}</td>
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
                <Upload className="mr-1.5 h-4 w-4" /> {importing ? 'Importando...' : `Importar ${valid.length} perfil(is)`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
