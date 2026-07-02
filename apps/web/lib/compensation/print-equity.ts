import type { EquityGroup, EquityReport } from './types';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
}

function money(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function gap(value: number | null): string {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function groupRows(groups: EquityGroup[]): string {
  return groups
    .map((group) => {
      const values = group.suppressed
        ? `<td colspan="4" class="suppressed">Suprimido (menos de 3 pessoas de um dos gêneros)</td>`
        : `<td>${money(group.medianWomen)}</td><td>${money(group.medianMen)}</td><td class="${(group.gapMedianPct ?? 0) < 0 ? 'neg' : 'pos'}">${gap(group.gapMedianPct)}</td><td class="${(group.gapMeanPct ?? 0) < 0 ? 'neg' : 'pos'}">${gap(group.gapMeanPct)}</td>`;
      return `<tr><td>${escapeHtml(group.label)}</td><td>${group.count}</td><td>${group.women}</td><td>${group.men}</td>${values}</tr>`;
    })
    .join('');
}

function groupTable(title: string, groups: EquityGroup[]): string {
  if (!groups.length) return '';
  return `<section>
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr><th>Grupo</th><th>Pessoas</th><th>Mulheres</th><th>Homens</th><th>Mediana F</th><th>Mediana M</th><th>Gap mediana</th><th>Gap média</th></tr></thead>
      <tbody>${groupRows(groups)}</tbody>
    </table>
  </section>`;
}

/**
 * Abre o Relatório de Transparência Salarial (base Lei 14.611/2023) formatado
 * para impressão/PDF do navegador.
 */
export function openEquityReportPrint(report: EquityReport): void {
  const today = new Date().toLocaleDateString('pt-BR');
  const womenPct = report.global.count ? ((report.global.women / report.global.count) * 100).toFixed(0) : '—';
  const leadPct = report.leadership.womenSharePct == null ? '—' : report.leadership.womenSharePct.toFixed(0);

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
  <title>Relatório de Transparência Salarial</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 32px; line-height: 1.5; font-size: 12px; }
    header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { font-size: 18px; margin: 0; }
    .meta { color: #555; font-size: 11px; margin-top: 4px; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #333; margin: 16px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    th { background: #f2f2f2; font-size: 10px; text-transform: uppercase; }
    .kpis { display: flex; gap: 16px; flex-wrap: wrap; margin: 12px 0; }
    .kpi { border: 1px solid #ccc; border-radius: 6px; padding: 8px 12px; min-width: 150px; }
    .kpi .v { font-size: 16px; font-weight: bold; }
    .kpi .l { font-size: 10px; color: #555; text-transform: uppercase; }
    .neg { color: #b91c1c; }
    .pos { color: #047857; }
    .suppressed { color: #777; font-style: italic; text-align: center; }
    footer { margin-top: 16px; border-top: 1px solid #ccc; padding-top: 8px; color: #555; font-size: 10px; }
    @media print { body { margin: 12mm; } }
  </style></head>
  <body>
    <header>
      <h1>Relatório de Transparência Salarial e de Critérios Remuneratórios</h1>
      <div class="meta">Base metodológica: Lei 14.611/2023 e Decreto 11.795/2023 · Emitido em ${today} · Dados agregados e anonimizados</div>
    </header>

    <div class="kpis">
      <div class="kpi"><div class="v">${gap(report.global.gapMedianPct)}</div><div class="l">Gap de mediana (geral)</div></div>
      <div class="kpi"><div class="v">${gap(report.global.gapMeanPct)}</div><div class="l">Gap de média (geral)</div></div>
      <div class="kpi"><div class="v">${womenPct}%</div><div class="l">Mulheres no quadro analisado</div></div>
      <div class="kpi"><div class="v">${leadPct}%</div><div class="l">Mulheres na liderança</div></div>
      <div class="kpi"><div class="v">${report.coverage.withGender}/${report.coverage.employees}</div><div class="l">Colaboradores com gênero informado</div></div>
    </div>

    ${groupTable('Visão geral', [report.global])}
    ${groupTable('Por grade salarial', report.byGrade)}
    ${groupTable('Por família de cargos', report.byFamily)}
    ${groupTable('Por área', report.byArea)}
    ${groupTable('Liderança', [report.leadership])}

    <footer>
      Gap = mediana (ou média) da remuneração das mulheres ÷ dos homens − 1; valores negativos indicam remuneração feminina inferior.
      ${escapeHtml(report.privacyNote)} Documento gerado pelo módulo Cargos e Salários (Gestão 360).
    </footer>
  </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
