'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface RubricItem {
  rubricCode: string;
  rubricName: string;
  nature: 'PROVENTO' | 'DESCONTO' | 'BASE' | 'INFORMATIVA';
  reference: string | null;
  amount: string;
}

interface PayslipData {
  id: string;
  baseSalary: string;
  totalEarnings: string;
  totalDeductions: string;
  netPay: string;
  inssBase: string;
  inssValue: string;
  irrfBase: string;
  irrfValue: string;
  fgtsBase: string;
  fgtsValue: string;
  run: {
    kind: string;
    competence: {
      year: number;
      month: number;
    };
  };
  employee: {
    name: string;
    registrationId: string | null;
    job?: { name: string } | null;
    orgNode?: { name: string } | null;
  } | null;
  items: RubricItem[];
}

export function formatCurrency(valueStr: string): string {
  const num = parseFloat(valueStr || '0');
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCompetence(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}/${year}`;
}

interface PayslipCardProps {
  data: PayslipData;
  companyName?: string;
  companyCnpj?: string;
}

export default function PayslipCard({ data, companyName = 'Gestão 360 Corp', companyCnpj = '00.000.000/0001-00' }: PayslipCardProps) {
  const handlePrint = () => {
    const printContent = document.getElementById(`payslip-print-${data.id}`);
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Holerite - ${data.employee?.name || 'Colaborador'}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { padding: 1.5cm; font-family: monospace; font-size: 11px; }
              .no-print { display: none; }
              .page-break { page-break-after: always; }
              .border-print { border: 1px solid #000 !important; }
              .border-t-print { border-top: 1px solid #000 !important; }
              .border-b-print { border-bottom: 1px solid #000 !important; }
              .border-r-print { border-right: 1px solid #000 !important; }
              .border-l-print { border-left: 1px solid #000 !important; }
            }
            body { font-family: monospace; font-size: 11px; }
            .border-print { border: 1px solid #000; }
            .border-t-print { border-top: 1px solid #000; }
            .border-b-print { border-bottom: 1px solid #000; }
            .border-r-print { border-right: 1px solid #000; }
            .border-l-print { border-left: 1px solid #000; }
          </style>
        </head>
        <body onload="window.print();window.close()">
          <div class="max-w-[800px] mx-auto p-4">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const proventos = data.items.filter((i) => i.nature === 'PROVENTO');
  const descontos = data.items.filter((i) => i.nature === 'DESCONTO');
  const informativas = data.items.filter((i) => i.nature === 'INFORMATIVA');

  // Mesclar itens para exibição em tabela padrão de holerite
  const tableRows: Array<{
    code: string;
    name: string;
    ref: string;
    provento: string;
    desconto: string;
  }> = [];

  const maxRows = Math.max(proventos.length, descontos.length, informativas.length);

  for (let i = 0; i < maxRows; i++) {
    const prov = proventos[i];
    const desc = descontos[i];
    const inf = informativas[i];

    if (prov) {
      tableRows.push({
        code: prov.rubricCode,
        name: prov.rubricName,
        ref: prov.reference || '',
        provento: formatCurrency(prov.amount),
        desconto: '',
      });
    }
    if (desc) {
      tableRows.push({
        code: desc.rubricCode,
        name: desc.rubricName,
        ref: desc.reference || '',
        provento: '',
        desconto: formatCurrency(desc.amount),
      });
    }
    if (inf) {
      tableRows.push({
        code: inf.rubricCode,
        name: inf.rubricName,
        ref: inf.reference || '',
        provento: '',
        desconto: `(${formatCurrency(inf.amount)})*`,
      });
    }
  }

  // Preencher linhas vazias para manter o visual uniforme (mínimo de 6 linhas)
  while (tableRows.length < 6) {
    tableRows.push({ code: '', name: '', ref: '', provento: '', desconto: '' });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end no-print">
        <Button onClick={handlePrint} size="sm" variant="outline">
          <Printer className="mr-2 h-4 w-4" /> Imprimir Holerite
        </Button>
      </div>

      <Card className="overflow-hidden border-border/60 bg-card text-foreground select-none">
        <CardContent className="p-0 font-mono text-[11px]" id={`payslip-print-${data.id}`}>
          {/* Cabeçalho do Recibo */}
          <div className="grid grid-cols-4 border-b border-black">
            <div className="col-span-3 p-2 border-r border-black">
              <div className="font-bold uppercase text-[12px]">{companyName}</div>
              <div>CNPJ: {companyCnpj}</div>
              <div className="text-[10px] text-muted-foreground/90 mt-1">RECIBO DE PAGAMENTO DE SALÁRIO</div>
            </div>
            <div className="p-2 text-center flex flex-col justify-center bg-muted/20">
              <div className="font-semibold text-muted-foreground text-[9px] uppercase">Competência</div>
              <div className="text-[14px] font-bold">
                {formatCompetence(data.run.competence.year, data.run.competence.month)}
              </div>
              <div className="text-[9px] font-semibold text-muted-foreground uppercase mt-1">
                {data.run.kind === 'ADIANTAMENTO' ? 'Adiantamento' : 'Mensal'}
              </div>
            </div>
          </div>

          {/* Dados do Empregado */}
          <div className="grid grid-cols-6 border-b border-black text-[10px] bg-muted/5">
            <div className="col-span-1 p-2 border-r border-black">
              <span className="block font-semibold text-muted-foreground text-[8px] uppercase">Registro</span>
              <span className="font-bold">{data.employee?.registrationId || '—'}</span>
            </div>
            <div className="col-span-3 p-2 border-r border-black">
              <span className="block font-semibold text-muted-foreground text-[8px] uppercase">Nome do Colaborador</span>
              <span className="font-bold text-[11px] uppercase">{data.employee?.name || '—'}</span>
            </div>
            <div className="col-span-2 p-2">
              <span className="block font-semibold text-muted-foreground text-[8px] uppercase">Cargo</span>
              <span className="truncate block font-bold">{data.employee?.job?.name || '—'}</span>
            </div>
          </div>

          {/* Cabeçalho da Tabela de Rubricas */}
          <div className="grid grid-cols-12 border-b border-black font-bold bg-muted/20 text-[9px] uppercase py-1 px-2">
            <div className="col-span-1 text-center">Cód.</div>
            <div className="col-span-5">Descrição</div>
            <div className="col-span-2 text-right">Referência</div>
            <div className="col-span-2 text-right">Proventos</div>
            <div className="col-span-2 text-right">Descontos</div>
          </div>

          {/* Corpo da Tabela de Rubricas */}
          <div className="divide-y divide-muted/30 min-h-[160px] flex flex-col justify-between">
            <div className="flex-1">
              {tableRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 px-2 py-1 items-center hover:bg-muted/5">
                  <div className="col-span-1 text-center font-semibold text-muted-foreground">{row.code}</div>
                  <div className="col-span-5 font-medium truncate uppercase">{row.name}</div>
                  <div className="col-span-2 text-right">{row.ref}</div>
                  <div className="col-span-2 text-right font-semibold text-emerald-600 dark:text-emerald-500">
                    {row.provento || ''}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-red-600 dark:text-red-400">
                    {row.desconto || ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé da Tabela de Rubricas */}
            <div className="border-t border-black bg-muted/5">
              {/* Totais */}
              <div className="grid grid-cols-12 px-2 py-1.5 font-bold border-b border-black text-[10px]">
                <div className="col-span-8 text-right">Totais</div>
                <div className="col-span-2 text-right text-emerald-600 dark:text-emerald-500">
                  {formatCurrency(data.totalEarnings)}
                </div>
                <div className="col-span-2 text-right text-red-600 dark:text-red-400">
                  {formatCurrency(data.totalDeductions)}
                </div>
              </div>

              {/* Líquido */}
              <div className="grid grid-cols-12 px-2 py-2 font-bold text-[12px] bg-muted/20 items-center">
                <div className="col-span-8 text-right uppercase text-muted-foreground text-[10px]">Valor Líquido a Receber</div>
                <div className="col-span-4 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400 pr-1">
                  R$ {formatCurrency(data.netPay)}
                </div>
              </div>
            </div>
          </div>

          {/* Bases Legais */}
          <div className="grid grid-cols-5 border-t border-black text-[9px] uppercase bg-muted/5">
            <div className="p-1.5 border-r border-black text-center">
              <span className="block text-muted-foreground text-[8px]">Salário Base</span>
              <span className="font-semibold">{formatCurrency(data.baseSalary)}</span>
            </div>
            <div className="p-1.5 border-r border-black text-center">
              <span className="block text-muted-foreground text-[8px]">Base Cálc. INSS</span>
              <span className="font-semibold">{formatCurrency(data.inssBase)}</span>
            </div>
            <div className="p-1.5 border-r border-black text-center">
              <span className="block text-muted-foreground text-[8px]">Val. do INSS</span>
              <span className="font-semibold">{formatCurrency(data.inssValue)}</span>
            </div>
            <div className="p-1.5 border-r border-black text-center">
              <span className="block text-muted-foreground text-[8px]">Base Cálc. FGTS</span>
              <span className="font-semibold">{formatCurrency(data.fgtsBase)}</span>
            </div>
            <div className="p-1.5 text-center">
              <span className="block text-muted-foreground text-[8px]">FGTS do Mês</span>
              <span className="font-semibold">{formatCurrency(data.fgtsValue)}</span>
            </div>
          </div>

          <div className="grid grid-cols-5 border-t border-black text-[9px] uppercase bg-muted/5">
            <div className="p-1.5 border-r border-black text-center col-span-1">
              <span className="block text-muted-foreground text-[8px]">Base Cálc. IRRF</span>
              <span className="font-semibold">{formatCurrency(data.irrfBase)}</span>
            </div>
            <div className="p-1.5 border-r border-black text-center col-span-1">
              <span className="block text-muted-foreground text-[8px]">Val. do IRRF</span>
              <span className="font-semibold">{formatCurrency(data.irrfValue)}</span>
            </div>
            <div className="p-1.5 col-span-3 flex items-center px-3 text-muted-foreground font-medium text-[9px] normal-case">
              {data.run.kind === 'ADIANTAMENTO' ? (
                <span>* Valores de adiantamento não possuem incidência direta (apenas na folha mensal).</span>
              ) : (
                <span>Declaro ter recebido a importância líquida discriminada neste recibo.</span>
              )}
            </div>
          </div>

          {/* Assinatura */}
          <div className="grid grid-cols-2 border-t border-black py-4 px-6 text-[10px] items-center bg-muted/10">
            <div>
              <div className="w-[180px] border-b border-black/50 h-[30px]"></div>
              <div className="mt-1 text-muted-foreground text-[9px] uppercase">Data / Assinatura do Empregado</div>
            </div>
            <div className="text-right text-[8px] text-muted-foreground">
              <div>Emitido via Gestão 360 em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</div>
              <div className="font-mono mt-0.5">Autenticação: {data.id.slice(0, 8).toUpperCase()}-{data.id.slice(-8).toUpperCase()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
