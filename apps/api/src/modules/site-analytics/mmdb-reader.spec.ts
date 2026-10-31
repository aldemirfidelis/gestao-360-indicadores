import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ipToBytes, MmdbReader } from './mmdb-reader';

// Codificador mínimo do formato MaxMind DB, só para montar bases de teste.
class Pointer {
  constructor(readonly offset: number) {}
}
type Value = string | number | boolean | Pointer | Value[] | { [key: string]: Value };

const bigEndian = (value: number, width: number) => Array.from({ length: width }, (_, i) => Math.floor(value / 256 ** (width - 1 - i)) % 256);
const ctrl = (type: number, size: number) => (type <= 7 ? [(type << 5) | size] : [size, type - 7]);
const uint = (type: number, value: number, width: number) => [...ctrl(type, width), ...bigEndian(value, width)];

function encode(value: Value): number[] {
  if (typeof value === 'string') {
    const bytes = [...Buffer.from(value, 'utf8')];
    return [...ctrl(2, bytes.length), ...bytes];
  }
  if (typeof value === 'number') return uint(6, value, 4);
  if (typeof value === 'boolean') return ctrl(14, value ? 1 : 0);
  if (value instanceof Pointer) return [(1 << 5) | (value.offset >> 8), value.offset & 0xff];
  if (Array.isArray(value)) return [...ctrl(11, value.length), ...value.flatMap(encode)];
  const entries = Object.entries(value);
  return [...ctrl(7, entries.length), ...entries.flatMap(([k, v]) => [...encode(k), ...encode(v)])];
}

function metadata(nodeCount: number, recordSize: number, ipVersion: number) {
  return [
    ...ctrl(7, 9),
    ...encode('binary_format_major_version'), ...uint(5, 2, 2),
    ...encode('binary_format_minor_version'), ...uint(5, 0, 2),
    ...encode('build_epoch'), ...uint(9, 1_790_000_000, 8),
    ...encode('database_type'), ...encode('Test-City'),
    ...encode('description'), ...encode({ en: 'teste' }),
    ...encode('ip_version'), ...uint(5, ipVersion, 2),
    ...encode('languages'), ...encode(['en']),
    ...encode('node_count'), ...uint(6, nodeCount, 4),
    ...encode('record_size'), ...uint(5, recordSize, 2),
  ];
}

/** Árvore com nós [esquerda, direita]: número = outro nó (ou "fora da base"), 'data:N' = N-ésimo registro. */
function build(opts: { recordSize: 24 | 32; ipVersion: 4 | 6; nodes: (number | string)[][]; records: Value[] }) {
  const data: number[] = [];
  const offsets = opts.records.map((record) => {
    const at = data.length;
    data.push(...encode(record));
    return at;
  });
  const nodeCount = opts.nodes.length;
  const target = (r: number | string) => (typeof r === 'number' ? r : nodeCount + 16 + offsets[Number(r.split(':')[1])]);
  const tree = opts.nodes.flatMap(([left, right]) => [...bigEndian(target(left), opts.recordSize / 8), ...bigEndian(target(right), opts.recordSize / 8)]);
  return Buffer.from([
    ...tree,
    ...new Array<number>(16).fill(0),
    ...data,
    0xab, 0xcd, 0xef, ...Buffer.from('MaxMind.com'),
    ...metadata(nodeCount, opts.recordSize, opts.ipVersion),
  ]);
}

const SP = { country: { iso_code: 'BR' }, subdivisions: [{ names: { en: 'São Paulo' } }], city: { names: { en: 'Campinas' } } };
const US = { country: { iso_code: 'US' }, city: { names: { en: 'Mountain View' } } };

describe('ipToBytes', () => {
  it('lê IPv4, IPv6 e IPv4 dentro de IPv6', () => {
    expect(ipToBytes('200.1.2.3')).toEqual([200, 1, 2, 3]);
    expect(ipToBytes('::ffff:200.1.2.3')).toEqual([200, 1, 2, 3]);
    expect(ipToBytes('2001:db8::1')).toEqual([0x20, 0x01, 0x0d, 0xb8, ...new Array<number>(11).fill(0), 1]);
    expect(ipToBytes('::')).toEqual(new Array<number>(16).fill(0));
    expect(ipToBytes('64:ff9b::1.2.3.4')?.slice(12)).toEqual([1, 2, 3, 4]);
  });

  it('recusa o que não é IP', () => {
    expect(ipToBytes('256.1.1.1')).toBeNull();
    expect(ipToBytes('localhost')).toBeNull();
    expect(ipToBytes('1::2::3')).toBeNull();
    expect(ipToBytes('1:2:3')).toBeNull();
  });
});

describe('MmdbReader', () => {
  it('base IPv4: percorre a árvore e decodifica mapas, listas e ponteiros', () => {
    // 0.0.0.0/1 → SP; 128.0.0.0/2 → registro cujo nome de cidade aponta para SP; 192.0.0.0/2 → fora da base.
    const reader = MmdbReader.fromBuffer(
      build({ recordSize: 24, ipVersion: 4, nodes: [['data:0', 1], ['data:1', 2]], records: [SP, { country: { iso_code: 'US' }, city: { names: { en: new Pointer(0) } } }] }),
    );
    expect(reader.metadata).toMatchObject({ nodeCount: 2, recordSize: 24, ipVersion: 4, databaseType: 'Test-City', buildEpoch: 1_790_000_000 });
    expect(reader.get('10.0.0.1')).toEqual(SP);
    expect(reader.get('150.0.0.1')).toEqual({ country: { iso_code: 'US' }, city: { names: { en: SP } } });
    expect(reader.get('200.0.0.1')).toBeNull();
    expect(reader.get('2001:db8::1')).toBeNull();
    expect(reader.get('não é ip')).toBeNull();
  });

  it('base IPv6 com registros de 32 bits: IPv4 fica em ::/96', () => {
    // 96 nós "zero" até a raiz IPv4 (nó 96): 0.0.0.0/1 → SP e 128.0.0.0/1 → US. 8000::/1 → US.
    const chain = Array.from({ length: 96 }, (_, i) => [i + 1, i === 0 ? 'data:1' : 97]);
    const reader = MmdbReader.fromBuffer(build({ recordSize: 32, ipVersion: 6, nodes: [...chain, ['data:0', 'data:1']], records: [SP, US] }));
    expect(reader.get('100.64.0.1')).toEqual(SP);
    expect(reader.get('::ffff:200.0.0.1')).toEqual(US);
    expect(reader.get('8000::1')).toEqual(US);
    expect(reader.get('0:8000::1')).toBeNull();
  });

  it('lê do arquivo em disco e recusa arquivo que não é .mmdb', () => {
    const dir = mkdtempSync(join(tmpdir(), 'g360-mmdb-'));
    try {
      const file = join(dir, 'teste.mmdb');
      writeFileSync(file, build({ recordSize: 24, ipVersion: 4, nodes: [['data:0', 1], ['data:0', 2]], records: [US] }));
      const reader = MmdbReader.open(file);
      expect(reader.get('1.2.3.4')).toEqual(US);
      reader.close();
      writeFileSync(file, 'isto não é uma base');
      expect(() => MmdbReader.open(file)).toThrow(/mmdb/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
