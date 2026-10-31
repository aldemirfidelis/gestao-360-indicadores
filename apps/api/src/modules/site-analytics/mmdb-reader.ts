import { closeSync, fstatSync, openSync, readSync } from 'fs';

/**
 * Leitor mínimo de bases MaxMind DB (.mmdb), o formato da base gratuita de localização por
 * IP da DB-IP. Entende só o necessário para uma consulta: metadados, árvore de busca e seção
 * de dados (https://maxmind.github.io/MaxMind-DB/). O arquivo é lido em blocos, sob demanda:
 * a base tem ~130 MB e a consulta toca poucos KB, então ela nunca vai inteira para a memória.
 */

const METADATA_MARKER = Buffer.concat([Buffer.from([0xab, 0xcd, 0xef]), Buffer.from('MaxMind.com')]);
const METADATA_MAX_SIZE = 128 * 1024;
const DATA_SEPARATOR = 16;
const BLOCK_SIZE = 4096;
/** ~8 MB de blocos em cache: a parte de cima da árvore é lida em toda consulta. */
const MAX_BLOCKS = 2048;

export interface MmdbMetadata {
  nodeCount: number;
  recordSize: number;
  ipVersion: number;
  databaseType: string;
  buildEpoch: number;
}

interface ByteSource {
  readonly size: number;
  bytes(offset: number, length: number): Buffer;
  close(): void;
}

class BufferSource implements ByteSource {
  constructor(private readonly buffer: Buffer) {}

  get size() {
    return this.buffer.length;
  }

  bytes(offset: number, length: number) {
    if (offset < 0 || offset + length > this.buffer.length) throw new Error('Leitura fora do arquivo .mmdb');
    return this.buffer.subarray(offset, offset + length);
  }

  close() {}
}

class FileSource implements ByteSource {
  private readonly blocks = new Map<number, Buffer>();

  constructor(
    private readonly fd: number,
    readonly size: number,
  ) {}

  bytes(offset: number, length: number) {
    if (offset < 0 || offset + length > this.size) throw new Error('Leitura fora do arquivo .mmdb');
    if (length === 0) return Buffer.alloc(0);
    const first = Math.floor(offset / BLOCK_SIZE);
    const last = Math.floor((offset + length - 1) / BLOCK_SIZE);
    const start = offset - first * BLOCK_SIZE;
    if (first === last) return this.block(first).subarray(start, start + length);
    const parts: Buffer[] = [];
    for (let i = first; i <= last; i++) parts.push(this.block(i));
    return Buffer.concat(parts).subarray(start, start + length);
  }

  private block(index: number) {
    const cached = this.blocks.get(index);
    if (cached) {
      // Reinsere no fim do Map: o mais antigo é o que sai quando o cache enche.
      this.blocks.delete(index);
      this.blocks.set(index, cached);
      return cached;
    }
    if (this.blocks.size >= MAX_BLOCKS) this.blocks.delete(this.blocks.keys().next().value as number);
    const position = index * BLOCK_SIZE;
    const block = Buffer.alloc(Math.min(BLOCK_SIZE, this.size - position));
    readSync(this.fd, block, 0, block.length, position);
    this.blocks.set(index, block);
    return block;
  }

  close() {
    this.blocks.clear();
    closeSync(this.fd);
  }
}

/** Seção de dados: valores tipados; ponteiros são relativos ao início da seção (`base`). */
class Decoder {
  constructor(
    private readonly src: ByteSource,
    private readonly base: number,
  ) {}

  decode(offset: number, depth = 0): [unknown, number] {
    if (depth > 32) throw new Error('Arquivo .mmdb inválido (aninhamento excessivo)');
    const ctrl = this.src.bytes(offset++, 1)[0];
    let type = ctrl >> 5;
    if (type === 1) {
      const [pointer, next] = this.pointer(ctrl, offset);
      return [this.decode(this.base + pointer, depth + 1)[0], next];
    }
    if (type === 0) type = 7 + this.src.bytes(offset++, 1)[0];
    let size = ctrl & 0x1f;
    if (size >= 29) {
      const extra = this.src.bytes(offset, size - 28);
      offset += size - 28;
      size = size === 29 ? 29 + extra[0] : size === 30 ? 285 + extra.readUInt16BE(0) : 65821 + extra.readUIntBE(0, 3);
    }
    switch (type) {
      case 2:
        return [this.src.bytes(offset, size).toString('utf8'), offset + size];
      case 3:
        return [this.src.bytes(offset, 8).readDoubleBE(0), offset + 8];
      case 4:
        return [Buffer.from(this.src.bytes(offset, size)), offset + size];
      case 5:
      case 6:
      case 9:
      case 10:
        return [this.unsigned(offset, size), offset + size];
      case 7: {
        const map: Record<string, unknown> = {};
        for (let i = 0; i < size; i++) {
          const [key, afterKey] = this.decode(offset, depth + 1);
          const [value, afterValue] = this.decode(afterKey, depth + 1);
          map[String(key)] = value;
          offset = afterValue;
        }
        return [map, offset];
      }
      case 8: {
        // int32 com menos de 4 bytes é sempre positivo.
        if (size === 0) return [0, offset];
        const bytes = this.src.bytes(offset, size);
        return [size === 4 ? bytes.readInt32BE(0) : bytes.readUIntBE(0, size), offset + size];
      }
      case 11: {
        const list: unknown[] = [];
        for (let i = 0; i < size; i++) {
          const [value, next] = this.decode(offset, depth + 1);
          list.push(value);
          offset = next;
        }
        return [list, offset];
      }
      case 14:
        return [size !== 0, offset];
      case 15:
        return [this.src.bytes(offset, 4).readFloatBE(0), offset + 4];
      default:
        throw new Error(`Arquivo .mmdb inválido (tipo de dado ${type})`);
    }
  }

  private pointer(ctrl: number, offset: number): [number, number] {
    const extra = ((ctrl >> 3) & 0x3) + 1;
    const value = ctrl & 0x7;
    const b = this.src.bytes(offset, extra);
    const pointer =
      extra === 1
        ? (value << 8) | b[0]
        : extra === 2
          ? ((value << 16) | b.readUInt16BE(0)) + 2048
          : extra === 3
            ? ((value << 24) | b.readUIntBE(0, 3)) + 526336
            : b.readUInt32BE(0);
    return [pointer, offset + extra];
  }

  /** uint16/32/64/128: 64 e 128 bits perdem precisão acima de 2^53 (irrelevante para localização). */
  private unsigned(offset: number, size: number) {
    let value = 0;
    for (const byte of this.src.bytes(offset, size)) value = value * 256 + byte;
    return value;
  }
}

/** IPv4 (4 bytes) ou IPv6 (16 bytes); IPv4 dentro de IPv6 (::ffff:1.2.3.4) vira IPv4. */
export function ipToBytes(raw: string): number[] | null {
  let ip = raw.trim().split('%')[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) ip = mapped[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every((p) => p <= 255) ? parts : null;
  }
  if (!ip.includes(':')) return null;
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (v4) {
    const b = ipToBytes(v4[1]);
    if (!b) return null;
    ip = `${ip.slice(0, -v4[1].length)}${((b[0] << 8) | b[1]).toString(16)}:${((b[2] << 8) | b[3]).toString(16)}`;
  }
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...new Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.flatMap((g) => {
    const v = parseInt(g, 16);
    return [v >> 8, v & 0xff];
  });
}

export class MmdbReader {
  readonly metadata: MmdbMetadata;
  private readonly treeSize: number;
  private readonly data: Decoder;
  private ipv4Root: number | null = null;

  private constructor(private readonly src: ByteSource) {
    try {
      const tailStart = Math.max(0, src.size - METADATA_MAX_SIZE);
      const at = src.bytes(tailStart, src.size - tailStart).lastIndexOf(METADATA_MARKER);
      if (at < 0) throw new Error('Arquivo .mmdb inválido (sem metadados)');
      const metadataStart = tailStart + at + METADATA_MARKER.length;
      const [raw] = new Decoder(src, metadataStart).decode(metadataStart);
      const m = (raw ?? {}) as Record<string, unknown>;
      this.metadata = {
        nodeCount: Number(m.node_count),
        recordSize: Number(m.record_size),
        ipVersion: Number(m.ip_version),
        databaseType: String(m.database_type ?? ''),
        buildEpoch: Number(m.build_epoch ?? 0),
      };
      const { nodeCount, recordSize, ipVersion } = this.metadata;
      if (m.binary_format_major_version !== 2 || ![24, 28, 32].includes(recordSize) || ![4, 6].includes(ipVersion) || !(nodeCount > 0)) {
        throw new Error('Arquivo .mmdb em formato não suportado');
      }
      this.treeSize = ((recordSize * 2) / 8) * nodeCount;
      if (this.treeSize + DATA_SEPARATOR > metadataStart) throw new Error('Arquivo .mmdb inválido (árvore maior que o arquivo)');
      this.data = new Decoder(src, this.treeSize + DATA_SEPARATOR);
    } catch (err) {
      src.close();
      throw err;
    }
  }

  /** Abre a base lendo o arquivo sob demanda; feche com `close()`. */
  static open(file: string): MmdbReader {
    const fd = openSync(file, 'r');
    try {
      return new MmdbReader(new FileSource(fd, fstatSync(fd).size));
    } catch (err) {
      try {
        closeSync(fd);
      } catch {
        /* já fechado pelo construtor */
      }
      throw err;
    }
  }

  static fromBuffer(buffer: Buffer): MmdbReader {
    return new MmdbReader(new BufferSource(buffer));
  }

  /** Registro do IP; null para IP inválido ou fora da base. */
  get(ip: string): unknown {
    const bytes = ipToBytes(ip);
    if (!bytes) return null;
    const { nodeCount, ipVersion } = this.metadata;
    if (bytes.length === 16 && ipVersion === 4) return null;
    let node = bytes.length === 4 && ipVersion === 6 ? this.ipv4Start() : 0;
    const bits = bytes.length * 8;
    for (let i = 0; i < bits && node < nodeCount; i++) {
      node = this.record(node, (bytes[i >> 3] >> (7 - (i & 7))) & 1);
    }
    if (node <= nodeCount) return null;
    return this.data.decode(this.treeSize + node - nodeCount)[0];
  }

  close() {
    this.src.close();
  }

  /** Numa base IPv6, os IPv4 ficam depois de 96 bits zero (::/96). */
  private ipv4Start() {
    if (this.ipv4Root === null) {
      let node = 0;
      for (let i = 0; i < 96 && node < this.metadata.nodeCount; i++) node = this.record(node, 0);
      this.ipv4Root = node;
    }
    return this.ipv4Root;
  }

  private record(node: number, bit: number) {
    const { recordSize } = this.metadata;
    const b = this.src.bytes(node * (recordSize / 4), recordSize / 4);
    if (recordSize === 24) return b.readUIntBE(bit ? 3 : 0, 3);
    if (recordSize === 28) return bit ? ((b[3] & 0x0f) << 24) | b.readUIntBE(4, 3) : ((b[3] & 0xf0) << 20) | b.readUIntBE(0, 3);
    return b.readUInt32BE(bit ? 4 : 0);
  }
}
