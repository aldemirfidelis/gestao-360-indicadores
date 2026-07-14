import { describe, expect, it } from 'vitest';
import {
  afdDateTime,
  companyTimeHHMM,
  crc16,
  generateAej,
  generateAfd,
  generateMirror,
  minutesLabel,
  type LegalEmployer,
} from './legal-files.logic';

const employer: LegalEmployer = {
  idType: 1,
  idNumber: '12345678000199',
  cnoCaepf: null,
  companyName: 'Empresa Demonstração Ltda',
  inpiRegistry: 'BR512026000001',
};

describe('legal-files.logic', () => {
  it('crc16: determinístico e com vetor conhecido (CRC-16/ARC)', () => {
    // Vetor clássico: "123456789" => 0xBB3D no CRC-16/ARC.
    expect(crc16('123456789')).toBe('BB3D');
    expect(crc16('abc')).toBe(crc16('abc'));
    expect(crc16('abc')).not.toBe(crc16('abd'));
  });

  it('afdDateTime: fuso fixo -0300 e minuto truncado', () => {
    expect(afdDateTime(new Date('2026-07-09T11:07:45.000Z'))).toBe('2026-07-09T08:07:00-0300');
  });

  it('generateAfd: header + tipo 7 por marcação + trailer com contagem', () => {
    const result = generateAfd({
      employer,
      from: '2026-07-01',
      to: '2026-07-31',
      punches: [
        { nsr: 1, cpf: '12345678901', punchedAt: new Date('2026-07-09T11:00:00Z'), hash: 'a'.repeat(64) },
        { nsr: 2, cpf: '12345678901', punchedAt: new Date('2026-07-09T20:00:00Z'), hash: 'b'.repeat(64) },
      ],
      generatedAt: new Date('2026-08-01T12:00:00Z'),
    });
    const lines = result.content.trimEnd().split('\r\n');
    expect(lines).toHaveLength(4); // header + 2 marcações + trailer
    // Header: NSR zero, tipo 1, CNPJ presente, remoção de acentos.
    expect(lines[0].startsWith('0000000001' + '1' + '12345678000199')).toBe(true);
    expect(lines[0]).toContain('Empresa Demonstracao Ltda');
    // Tipo 7: NSR sequencial + tipo + data/hora + CPF 12 + hash.
    expect(lines[1].startsWith('000000001' + '7' + '2026-07-09T08:00:00-0300' + '012345678901')).toBe(true);
    expect(lines[1]).toContain('a'.repeat(64));
    // Trailer: 999999999 e contagem do tipo 7 = 2.
    expect(lines[3].startsWith('999999999')).toBe(true);
    expect(lines[3]).toContain('000000002');
    // Cada linha termina com CRC-16 válido do conteúdo.
    for (const line of lines) {
      const body = line.slice(0, -4);
      expect(line.slice(-4)).toBe(crc16(body));
    }
    expect(result.warnings).toHaveLength(0);
  });

  it('generateAfd: sinaliza pendências (INPI e CPF ausentes)', () => {
    const result = generateAfd({
      employer: { ...employer, inpiRegistry: null },
      from: '2026-07-01',
      to: '2026-07-31',
      punches: [{ nsr: 1, cpf: null, punchedAt: new Date(), hash: 'c'.repeat(64) }],
      generatedAt: new Date(),
    });
    expect(result.warnings.some((warning) => warning.includes('INPI'))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('CPF'))).toBe(true);
  });

  it('generateAej: cabeçalho, vínculos, marcações, ausências e trailer', () => {
    const result = generateAej({
      employer,
      periodRef: '2026-07',
      from: '2026-07-01',
      to: '2026-07-31',
      employees: [{ cpf: '12345678901', name: 'Ana Silva' }],
      markings: [{ cpf: '12345678901', punchedAt: new Date('2026-07-09T11:00:00Z'), nsr: 10, direction: 'E' }],
      absences: [{ cpf: '12345678901', dayKey: '2026-07-10', kind: 'FERIAS' }],
      generatedAt: new Date('2026-08-01T12:00:00Z'),
    });
    const lines = result.content.trimEnd().split('\r\n');
    expect(lines[0].startsWith('01|1|12345678000199|')).toBe(true);
    expect(lines[1]).toBe('02|1|12345678901|Ana Silva');
    expect(lines[2]).toBe('04|12345678901|2026-07-09T08:00:00-0300|10|E');
    expect(lines[3]).toBe('05|12345678901|2026-07-10|FERIAS');
    expect(lines[4]).toBe('99|1|1|1');
  });

  it('minutesLabel/companyTimeHHMM: formatos HH:MM (com sinal quando pedido)', () => {
    expect(minutesLabel(528)).toBe('08:48');
    expect(minutesLabel(2, true)).toBe('+00:02');
    expect(minutesLabel(-90, true)).toBe('-01:30');
    expect(companyTimeHHMM(new Date('2026-07-09T11:07:00Z'))).toBe('08:07');
  });

  it('generateMirror: identificação, dias com marcações/NSR, totais e avisos', () => {
    const result = generateMirror({
      employer,
      employee: { name: 'Ana Silva', cpf: '12345678901', pisPasep: '12065812345', admissionDate: '2024-02-01', jobTitle: 'Analista' },
      periodRef: '2026-07',
      days: [
        {
          dayKey: '2026-07-09',
          holiday: null,
          status: 'OVERTIME',
          plannedMinutes: 528,
          workedMinutes: 530,
          balanceMinutes: 2,
          marks: [
            { time: '08:00', source: 'WEB', nsr: '15' },
            { time: '12:00', source: 'WEB', nsr: '16' },
            { time: '13:00', source: 'WEB', nsr: '17' },
            { time: '17:50', source: 'WEB', nsr: '18' },
          ],
        },
        { dayKey: '2026-07-10', holiday: null, status: 'ABSENT', plannedMinutes: 528, workedMinutes: 0, balanceMinutes: -528, marks: [] },
        { dayKey: '2026-07-11', holiday: 'Aniversário da cidade', status: 'HOLIDAY', plannedMinutes: 0, workedMinutes: 0, balanceMinutes: 0, marks: [] },
      ],
      generatedAt: new Date('2026-08-01T12:00:00Z'),
      softwareVersion: 'gestao360-ponto',
    });
    const content = result.content;
    // Identificação sem acentos (ASCII) e competência no cabeçalho.
    expect(content).toContain('ESPELHO DE PONTO ELETRONICO');
    expect(content).toContain('Competencia 2026-07');
    expect(content).toContain('Empregador: Empresa Demonstracao Ltda');
    expect(content).toContain('Colaborador: Ana Silva');
    expect(content).toContain('CPF: 12345678901');
    // Dia com marcações: horário + NSR entre parênteses, saldo com sinal e situação.
    const dayLine = content.split('\r\n').find((line) => line.startsWith('2026-07-09'))!;
    expect(dayLine).toContain('08:00(15) 12:00(16) 13:00(17) 17:50(18)');
    expect(dayLine).toContain('+00:02');
    expect(dayLine).toContain('Credito');
    // Falta e feriado nomeado.
    expect(content.split('\r\n').find((line) => line.startsWith('2026-07-10'))).toContain('Falta');
    expect(content.split('\r\n').find((line) => line.startsWith('2026-07-11'))).toContain('Feriado: Aniversario da cidade');
    // Totais consolidados: 1056 previstos, 530 trabalhados, saldo -526, 1 falta.
    expect(content).toContain('Totais: Prevista 17:36  Trabalhada 08:50  Saldo -08:46  Faltas 1  Inconsistencias 0');
    expect(result.warnings).toHaveLength(0);
  });

  it('generateMirror: avisa CPF/INPI ausentes e dias inconsistentes', () => {
    const result = generateMirror({
      employer: { ...employer, inpiRegistry: null },
      employee: { name: 'Sem Cadastro', cpf: null },
      periodRef: '2026-07',
      days: [{ dayKey: '2026-07-09', holiday: null, status: 'INCOMPLETE', plannedMinutes: 528, workedMinutes: 0, balanceMinutes: 0, marks: [{ time: '08:00', source: 'WEB', nsr: null }] }],
      generatedAt: new Date(),
      softwareVersion: 'gestao360-ponto',
    });
    expect(result.warnings.some((warning) => warning.includes('CPF'))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('INPI'))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('inconsistente'))).toBe(true);
    // Marcação sem NSR sai só com o horário.
    expect(result.content).toContain('08:00 ');
    expect(result.content).not.toContain('08:00(');
  });
});
