import { describe, expect, it } from 'vitest';
import { antifraudChecks, buildCnab240, parseCnab240Return } from './payroll-bank.logic';

const company = { bankCode: '341', cnpj: '12345678000190', name: 'Empresa Demo', agency: '1234', account: '567890', accountDigit: '1' };

describe('payroll-bank.logic', () => {
  it('gera CNAB 240 com linhas de 240 e totais corretos', () => {
    const result = buildCnab240({
      company,
      items: [
        { favoredBankCode: '341', favoredAgency: '1234', favoredAccount: '111111', favoredAccountDigit: '2', favoredName: 'Ana Silva', favoredCpf: '12345678909', amountCents: 291398, paymentDate: '2026-08-05' },
        { favoredBankCode: '001', favoredAgency: '4321', favoredAccount: '222222', favoredAccountDigit: '3', favoredName: 'João Souza', favoredCpf: '98765432100', amountCents: 150000, paymentDate: '2026-08-05' },
      ],
      fileSequence: 1,
      generatedAt: new Date('2026-08-01T10:00:00Z'),
    });
    const lines = result.content.split('\r\n').filter((l) => l.length > 0);
    // header arquivo + header lote + 2 detalhes + trailer lote + trailer arquivo = 6
    expect(lines).toHaveLength(6);
    for (const line of lines) expect(line).toHaveLength(240);
    expect(lines[0].startsWith('341')).toBe(true);
    expect(result.totalCents).toBe(441398);
    // valor do 1º item aparece no segmento A
    expect(lines[2]).toContain('000000000291398');
    expect(lines[2]).toContain('ANA SILVA');
  });

  it('antifraude detecta conta/pix repetidos, desligado e sem conta', () => {
    const alerts = antifraudChecks({
      items: [
        { employeeId: 'a', name: 'Ana', account: '111-2', pixKey: null, netCents: 300000, active: true, accountChangedRecently: false },
        { employeeId: 'b', name: 'Bia', account: '111-2', pixKey: null, netCents: 300000, active: true, accountChangedRecently: true },
        { employeeId: 'c', name: 'Caio', account: null, pixKey: null, netCents: 300000, active: false, accountChangedRecently: false },
      ],
    });
    expect(alerts.some((a) => a.code === 'DUP_ACCOUNT')).toBe(true);
    expect(alerts.some((a) => a.code === 'INACTIVE' && a.employeeId === 'c')).toBe(true);
    expect(alerts.some((a) => a.code === 'NO_ACCOUNT' && a.employeeId === 'c')).toBe(true);
    expect(alerts.some((a) => a.code === 'ACCOUNT_CHANGED' && a.employeeId === 'b')).toBe(true);
  });

  it('antifraude detecta líquido fora do padrão (outlier)', () => {
    const alerts = antifraudChecks({
      items: [
        { employeeId: 'a', name: 'Ana', account: '1', pixKey: null, netCents: 100000, active: true, accountChangedRecently: false },
        { employeeId: 'b', name: 'Bia', account: '2', pixKey: null, netCents: 100000, active: true, accountChangedRecently: false },
        { employeeId: 'c', name: 'Caio', account: '3', pixKey: null, netCents: 5000000, active: true, accountChangedRecently: false },
      ],
    });
    expect(alerts.some((a) => a.code === 'OUTLIER' && a.employeeId === 'c')).toBe(true);
  });

  it('lê retorno CNAB e marca pago/rejeitado', () => {
    // Reusa a própria remessa como base e injeta um código de ocorrência.
    const gen = buildCnab240({ company, items: [{ favoredBankCode: '341', favoredAgency: '1', favoredAccount: '1', favoredAccountDigit: '1', favoredName: 'Ana Silva', favoredCpf: '12345678909', amountCents: 291398, paymentDate: '2026-08-05' }], fileSequence: 1, generatedAt: new Date('2026-08-01T10:00:00Z') });
    const detail = gen.content.split('\r\n')[2];
    const paidLine = detail.slice(0, 230) + '00' + ' '.repeat(8);
    const parsed = parseCnab240Return(paidLine);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].paid).toBe(true);
    expect(parsed[0].amountCents).toBe(291398);
  });
});
