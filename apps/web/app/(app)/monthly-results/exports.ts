import { periodRefLabel } from '@/lib/utils';
import {
  ENTRY_KIND_LABEL,
  FOLLOWUP_LEVEL_LABEL,
  ITEM_STATUS_LABEL,
  LIGHT_LABEL,
  decisionOutputHeader,
  formatValue,
  type MeetingDetail,
} from './shared';

function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

type PdfDoc = import('jspdf').jsPDF;

function header(doc: PdfDoc, meeting: MeetingDetail, subtitle: string) {
  doc.setFontSize(14);
  doc.text(meeting.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${subtitle} · ${periodRefLabel(meeting.periodRef)}`, 14, 22);
  doc.setTextColor(0);
}

export async function exportAtaPdf(meeting: MeetingDetail) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF();
  header(doc, meeting, 'Ata da Reunião Mensal');
  let y = 30;

  doc.setFontSize(11);
  doc.text('Dados da reunião', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y + 2,
    theme: 'plain',
    styles: { fontSize: 9 },
    body: [
      ['Data', fmtDate(meeting.startsAt)],
      ['Local', meeting.location ?? '—'],
      ['Responsável', meeting.responsible?.name ?? '—'],
      ['Secretário', meeting.secretary?.name ?? '—'],
      ['Status', meeting.statusLabel],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (meeting.keyMessage) {
    doc.setFontSize(11);
    doc.text('Mensagem-chave', 14, y);
    y += 5;
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(meeting.keyMessage, 180);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
  }

  const criticals = meeting.areas
    .flatMap((a) => a.indicators.map((i) => ({ area: a.name, ...i })))
    .filter((i) => i.light === 'RED' || i.light === 'YELLOW' || i.isCritical);
  if (criticals.length) {
    doc.setFontSize(11);
    doc.text('Indicadores críticos discutidos', 14, y);
    autoTable(doc, {
      startY: y + 2,
      styles: { fontSize: 8 },
      head: [['Área', 'Indicador', 'Farol', 'Realizado', 'Meta', 'Causa raiz', 'Ação']],
      body: criticals.map((i) => [i.area, i.name, LIGHT_LABEL[i.light], formatValue(i.current, i.unitLabel), formatValue(i.target, i.unitLabel), i.rootCause ?? '—', i.actionTitle ?? '—']),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (meeting.decisions.length) {
    const decisionGroups = new Map<string, typeof meeting.decisions>();
    for (const decision of meeting.decisions) {
      const groupHeader = decision.boardInvolved?.trim() || decisionOutputHeader(meeting);
      decisionGroups.set(groupHeader, [...(decisionGroups.get(groupHeader) ?? []), decision]);
    }

    for (const [groupHeader, decisions] of decisionGroups) {
      doc.setFontSize(11);
      doc.text(groupHeader, 14, y);
      autoTable(doc, {
        startY: y + 2,
        styles: { fontSize: 8 },
        head: [['Tipo', 'Tema', 'Registro', 'Responsável', 'Prazo', 'Status']],
        body: decisions.map((d) => [ENTRY_KIND_LABEL[d.kind] ?? d.kind, d.topic ?? '—', d.description, d.owner ?? '—', fmtDate(d.dueDate), ITEM_STATUS_LABEL[d.status] ?? d.status]),
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  if (meeting.followUps.length) {
    doc.setFontSize(11);
    doc.text('Acompanhamento (pendências para a próxima reunião)', 14, y);
    autoTable(doc, {
      startY: y + 2,
      styles: { fontSize: 8 },
      head: [['Nível', 'Item', 'Responsável', 'Prazo', 'Status']],
      body: meeting.followUps.map((f) => [FOLLOWUP_LEVEL_LABEL[f.level] ?? f.level, f.title, f.owner?.name ?? '—', fmtDate(f.dueDate), ITEM_STATUS_LABEL[f.status] ?? f.status]),
    });
  }

  doc.save(`ata-${meeting.periodRef}.pdf`);
}

export async function exportResumoPdf(meeting: MeetingDetail, aiSummary?: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF();
  header(doc, meeting, 'Resumo Executivo');
  let y = 30;
  const lights = meeting.summary.lights;
  autoTable(doc, {
    startY: y,
    styles: { fontSize: 9 },
    head: [['Verde', 'Azul', 'Amarelo', 'Vermelho', 'Cinza']],
    body: [[String(lights.GREEN), String(lights.BLUE), String(lights.YELLOW), String(lights.RED), String(lights.GRAY)]],
  });
  y = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(10);
  const text = aiSummary || meeting.keyMessage || 'Sem resumo disponível.';
  const lines = doc.splitTextToSize(text, 180);
  doc.text(lines, 14, y);
  doc.save(`resumo-executivo-${meeting.periodRef}.pdf`);
}

export async function exportFarolXlsx(meeting: MeetingDetail) {
  const XLSX = await import('xlsx');
  const rows = meeting.areas.flatMap((a) =>
    a.indicators.map((i) => ({
      Área: a.name,
      Indicador: i.name,
      Meta: i.target ?? '',
      Realizado: i.current ?? '',
      Atingimento: i.attainment ?? '',
      Farol: LIGHT_LABEL[i.light],
      Tendência: i.trend ?? '',
      Causa: i.rootCause ?? '',
      'Plano de ação': i.actionTitle ?? '',
      Responsável: '',
    })),
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Farol');
  XLSX.writeFile(wb, `farol-${meeting.periodRef}.xlsx`);
}

export async function exportAcoesXlsx(meeting: MeetingDetail) {
  const XLSX = await import('xlsx');
  const rows: any[] = [];
  for (const area of meeting.areas) {
    for (const i of area.indicators) {
      if (i.linkedAction) {
        rows.push({
          Área: area.name,
          Indicador: i.name,
          Ação: i.linkedAction.title,
          Status: i.linkedAction.status,
          Progresso: i.linkedAction.progress,
        });
      }
    }
  }
  for (const d of meeting.decisions) {
    if (d.action) rows.push({ Área: '', Indicador: ENTRY_KIND_LABEL[d.kind] ?? d.kind, Ação: d.action.title, Status: d.action.status, Progresso: '' });
  }
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: 'Nenhuma ação vinculada à reunião.' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ações');
  XLSX.writeFile(wb, `acoes-${meeting.periodRef}.xlsx`);
}
