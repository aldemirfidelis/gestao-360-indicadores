import type { DescriptionRecord } from '@/components/compensation/description-editor-dialog';
import { DESCRIPTION_STATUS_LABELS } from './types';

// Secoes da descricao para impressao, na ordem de leitura.
const SECTIONS: Array<{ key: keyof DescriptionRecord; label: string }> = [
  { key: 'mission', label: 'Missão do cargo' },
  { key: 'responsibilities', label: 'Principais responsabilidades' },
  { key: 'detailedActivities', label: 'Atividades detalhadas' },
  { key: 'expectedDeliverables', label: 'Entregas esperadas' },
  { key: 'technicalSkills', label: 'Competências técnicas' },
  { key: 'behavioralSkills', label: 'Competências comportamentais' },
  { key: 'knowledge', label: 'Conhecimentos' },
  { key: 'tools', label: 'Ferramentas e sistemas' },
  { key: 'minimumEducation', label: 'Formação mínima' },
  { key: 'desiredEducation', label: 'Formação desejada' },
  { key: 'requiredExperience', label: 'Experiência exigida' },
  { key: 'requiredCourses', label: 'Cursos exigidos' },
  { key: 'certifications', label: 'Certificações' },
  { key: 'legalRequirements', label: 'Requisitos legais' },
  { key: 'immediateSuperior', label: 'Superior imediato' },
  { key: 'directReports', label: 'Subordinados diretos' },
  { key: 'autonomyLevel', label: 'Nível de autonomia' },
  { key: 'workEnvironment', label: 'Ambiente de trabalho' },
  { key: 'internalInterfaces', label: 'Interfaces internas' },
  { key: 'externalInterfaces', label: 'Interfaces externas' },
  { key: 'occupationalRisks', label: 'Riscos ocupacionais' },
  { key: 'epis', label: 'EPIs' },
  { key: 'notes', label: 'Observações' },
];

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
}

/** Abre uma janela com a descrição formatada e dispara o diálogo de impressão do navegador. */
export function printDescription(record: DescriptionRecord): void {
  const title = record.jobCatalog ? `${record.jobCatalog.code} - ${record.jobCatalog.name}` : 'Descrição de cargo';
  const statusLabel = DESCRIPTION_STATUS_LABELS[record.status] ?? record.status;

  const sectionsHtml = SECTIONS.filter((section) => {
    const value = record[section.key];
    return typeof value === 'string' && value.trim().length > 0;
  })
    .map((section) => {
      const value = String(record[section.key]);
      return `<section><h2>${escapeHtml(section.label)}</h2><p>${escapeHtml(value).replace(/\n/g, '<br/>')}</p></section>`;
    })
    .join('');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 32px; line-height: 1.5; }
    header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { font-size: 20px; margin: 0; }
    .meta { color: #555; font-size: 12px; margin-top: 4px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #333; margin: 18px 0 4px; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
    p { margin: 0; font-size: 13px; white-space: pre-wrap; }
    @media print { body { margin: 12mm; } }
  </style></head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Versão ${record.version} · ${escapeHtml(statusLabel)} · Emitido em ${new Date().toLocaleDateString('pt-BR')}</div>
    </header>
    ${sectionsHtml || '<p>Descrição sem conteúdo preenchido.</p>'}
  </body></html>`;

  const win = window.open('', '_blank', 'width=820,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  // pequeno atraso para garantir render antes de imprimir
  setTimeout(() => win.print(), 250);
}
