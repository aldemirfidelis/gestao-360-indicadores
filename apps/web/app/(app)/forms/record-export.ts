/**
 * Exportação do formulário preenchido (PDF e Excel).
 *
 * É o comprovante da inspeção: sai igual ao que o técnico respondeu em campo,
 * com cabeçalho, itens, participantes, observações e as fotos anexadas. Serve
 * para conferência posterior e para anexar em auditoria — por isso o PDF traz
 * a imagem embutida, e não um link que exige login.
 */

import { getAccessToken } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

export interface RecordAnswer {
  id: string;
  fieldLabel: string;
  fieldType?: string | null;
  value: string | null;
  /** Nota que a pergunta valia neste preenchimento. */
  weight?: number | null;
  /** Pontos obtidos: a nota se conforme, 0 se reprovado, null se não conta. */
  points?: number | null;
}

export interface RecordEvidence {
  id: string;
  fileName?: string | null;
  mimeType?: string | null;
  description?: string | null;
  type?: string | null;
}

export interface RecordParticipant {
  registrationId?: string | null;
  name?: string | null;
  jobTitle?: string | null;
  managerName?: string | null;
}

export interface ExportableRecord {
  id: string;
  code?: string | null;
  title: string | null;
  status: string;
  statusLabel: string;
  templateTitle: string;
  templateVersion?: string | null;
  orgNodeName?: string | null;
  submittedByName?: string | null;
  filledAt?: string | null;
  score?: number | null;
  /** Pontos obtidos / em disputa, quando o checklist é pontuado por nota. */
  points?: number | null;
  pointsTotal?: number | null;
  usesWeights?: boolean;
  notes?: string | null;
  answers: RecordAnswer[];
  participants: RecordParticipant[];
  evidence: RecordEvidence[];
}

/** Nome de arquivo seguro: sem acento, sem barra, sem espaço duplo. */
function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

function conformity(score: number | null | undefined): string {
  if (typeof score !== 'number') return '—';
  return `${score.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function pontos(value: number | null | undefined): string {
  if (typeof value !== 'number') return '—';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/** "70% (70 de 100 pontos)" em checklist pontuado; só o percentual nos demais. */
function resultado(record: ExportableRecord): string {
  const percent = conformity(record.score);
  if (!record.usesWeights) return percent;
  return `${percent} (${pontos(record.points)} de ${pontos(record.pointsTotal)} pontos)`;
}

function fileBase(record: ExportableRecord): string {
  return `${slug(record.templateTitle)}-${slug(record.code ?? record.id.slice(0, 8))}`;
}

/** Só imagem entra no PDF; anexo de outro tipo vira linha na lista de evidências. */
function isImage(evidence: RecordEvidence): boolean {
  return (evidence.mimeType ?? '').startsWith('image/');
}

/**
 * Baixa a evidência autenticada e devolve como data URL.
 * O endpoint exige o Bearer, então não dá para apontar um `<img src>` direto.
 */
async function evidenceDataUrl(evidenceId: string): Promise<string | null> {
  try {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/forms/evidence/${evidenceId}/content`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportRecordPdf(record: ExportableRecord): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF();
  const margin = 14;
  const width = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text(doc.splitTextToSize(record.templateTitle, width - margin * 2), margin, 16);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    [record.code, record.templateVersion ? `rev ${record.templateVersion}` : null, record.statusLabel]
      .filter(Boolean)
      .join('  ·  '),
    margin,
    22,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 26,
    theme: 'plain',
    styles: { fontSize: 9 },
    body: [
      ['Área / Setor', record.orgNodeName ?? '—'],
      ['Preenchido por', record.submittedByName ?? '—'],
      ['Data', formatDate(record.filledAt) || '—'],
      [record.usesWeights ? 'Resultado' : 'Conformidade', resultado(record)],
    ],
  });
  let y = (doc as any).lastAutoTable.finalY + 6;

  if (record.answers.length) {
    doc.setFontSize(11);
    doc.text('Respostas', margin, y);
    // Em checklist pontuado, a nota e os pontos de cada item entram na tabela:
    // é o que permite auditar o percentual linha a linha.
    autoTable(doc, {
      startY: y + 2,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: record.usesWeights
        ? { 0: { cellWidth: 8 }, 1: { cellWidth: 92 }, 3: { cellWidth: 14 }, 4: { cellWidth: 14 } }
        : { 0: { cellWidth: 10 }, 1: { cellWidth: 110 } },
      head: record.usesWeights ? [['#', 'Item', 'Resposta', 'Nota', 'Obtido']] : [['#', 'Item', 'Resposta']],
      body: record.answers.map((answer, index) => {
        const base = [String(index + 1), answer.fieldLabel, answer.value || '—'];
        if (!record.usesWeights) return base;
        // Pergunta sem nota entra no relatório como "—", e não como zero: ela
        // foi respondida, só não disputava ponto.
        const naConta = typeof answer.points === 'number';
        return [...base, typeof answer.weight === 'number' ? pontos(answer.weight) : '—', naConta ? pontos(answer.points) : '—'];
      }),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (record.participants.length) {
    doc.setFontSize(11);
    doc.text('Participantes', margin, y);
    autoTable(doc, {
      startY: y + 2,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      head: [['Matrícula', 'Nome', 'Cargo', 'Gestor']],
      body: record.participants.map((person) => [
        person.registrationId ?? '—',
        person.name ?? '—',
        person.jobTitle ?? '—',
        person.managerName ?? '—',
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (record.notes) {
    doc.setFontSize(11);
    doc.text('Observações', margin, y);
    y += 5;
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(record.notes, width - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  const photos = record.evidence.filter(isImage);
  if (photos.length) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const imageWidth = (width - margin * 2 - 6) / 2;
    const imageHeight = imageWidth * 0.75;
    if (y + 12 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(11);
    doc.text('Registro fotográfico', margin, y);
    y += 5;

    let column = 0;
    for (const photo of photos) {
      const dataUrl = await evidenceDataUrl(photo.id);
      if (!dataUrl) continue;
      if (y + imageHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        column = 0;
      }
      const x = margin + column * (imageWidth + 6);
      try {
        doc.addImage(dataUrl, x, y, imageWidth, imageHeight, undefined, 'FAST');
      } catch {
        // Formato que o jsPDF não decodifica (ex.: HEIC): segue sem a foto,
        // o PDF continua válido e a evidência permanece no sistema.
        continue;
      }
      column += 1;
      if (column === 2) {
        column = 0;
        y += imageHeight + 4;
      }
    }
  }

  doc.save(`${fileBase(record)}.pdf`);
}

export async function exportRecordXlsx(record: ExportableRecord): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const identification = [
    { Campo: 'Formulário', Valor: record.templateTitle },
    { Campo: 'Registro', Valor: record.code ?? record.id },
    { Campo: 'Versão', Valor: record.templateVersion ?? '' },
    { Campo: 'Status', Valor: record.statusLabel },
    { Campo: 'Área / Setor', Valor: record.orgNodeName ?? '' },
    { Campo: 'Preenchido por', Valor: record.submittedByName ?? '' },
    { Campo: 'Data', Valor: formatDate(record.filledAt) },
    { Campo: 'Conformidade', Valor: conformity(record.score) },
    ...(record.usesWeights
      ? [
          { Campo: 'Pontos obtidos', Valor: pontos(record.points) },
          { Campo: 'Pontos possíveis', Valor: pontos(record.pointsTotal) },
        ]
      : []),
    { Campo: 'Observações', Valor: record.notes ?? '' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(identification), 'Identificação');

  // Números vão como número (e não texto) para a planilha poder somar/conferir.
  const answers = record.answers.map((answer, index) => ({
    '#': index + 1,
    Item: answer.fieldLabel,
    Resposta: answer.value ?? '',
    ...(record.usesWeights ? { Nota: answer.weight ?? '', Obtido: answer.points ?? '' } : {}),
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(answers.length ? answers : [{ Aviso: 'Sem respostas registradas.' }]),
    'Respostas',
  );

  if (record.participants.length) {
    const participants = record.participants.map((person) => ({
      Matrícula: person.registrationId ?? '',
      Nome: person.name ?? '',
      Cargo: person.jobTitle ?? '',
      Gestor: person.managerName ?? '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(participants), 'Participantes');
  }

  XLSX.writeFile(wb, `${fileBase(record)}.xlsx`);
}

/** Planilha com a lista filtrada — uma linha por registro, para conferência em lote. */
export async function exportRecordListXlsx(records: ExportableRecord[]): Promise<void> {
  const XLSX = await import('xlsx');
  const rows = records.map((record) => ({
    Registro: record.code ?? record.id,
    Formulário: record.templateTitle,
    'Área / Setor': record.orgNodeName ?? '',
    'Preenchido por': record.submittedByName ?? '',
    Data: formatDate(record.filledAt),
    Status: record.statusLabel,
    Conformidade: conformity(record.score),
    'Pontos obtidos': record.usesWeights ? record.points ?? '' : '',
    'Pontos possíveis': record.usesWeights ? record.pointsTotal ?? '' : '',
    Respostas: record.answers.length,
    Fotos: record.evidence.filter(isImage).length,
    Observações: record.notes ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: 'Nenhum registro no filtro atual.' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `registros-formularios-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
