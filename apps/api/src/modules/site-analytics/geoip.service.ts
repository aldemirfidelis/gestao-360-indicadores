import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { mkdir, rename, rm, stat } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream } from 'stream/web';
import { createGunzip } from 'zlib';
import { MmdbReader } from './mmdb-reader';
import { brazilUf } from './site-context';

export interface GeoLocation {
  /** ISO 3166-1 (BR, US...). */
  country: string;
  /** UF no Brasil; fora dele, o nome do estado ou província. */
  region: string | null;
  city: string | null;
}

export interface GeoLookup {
  find(ip: string): GeoLocation | null;
  close(): void;
}

interface CityRecord {
  country?: { iso_code?: string };
  subdivisions?: { names?: { en?: string } }[];
  city?: { names?: { en?: string } };
}

/** Base gratuita "IP to City Lite" da DB-IP (CC BY 4.0, atribuição na tela do portal), publicada todo mês. */
const DB_URL = (month: string) => `https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz`;
const MAX_AGE_MS = 35 * 86_400_000;
const RETRY_AFTER_MS = 6 * 3600_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export function toGeoLocation(record: unknown): GeoLocation | null {
  const rec = record as CityRecord | null;
  const country = rec?.country?.iso_code;
  if (!country) return null;
  const state = rec.subdivisions?.[0]?.names?.en ?? null;
  return {
    country,
    region: (country === 'BR' ? brazilUf(state) : null) ?? state?.slice(0, 80) ?? null,
    city: rec.city?.names?.en?.slice(0, 120) ?? null,
  };
}

/**
 * Localização aproximada pelo IP, sem enviar o IP a terceiros: a base fica no volume de
 * armazenamento da API (storage/geoip, fora do backup do banco) e é renovada quando passa
 * de 35 dias. Sem base (download falhou), as visitas esperam a próxima rodada.
 */
@Injectable()
export class GeoIpService {
  private readonly logger = new Logger(GeoIpService.name);
  private readonly file = join(resolve(process.env.GEOIP_STORAGE_PATH ?? 'storage/geoip'), 'dbip-city-lite.mmdb');
  private lastFailure = 0;

  /** Abre a base para uma rodada de consultas; feche com `close()`. */
  async open(): Promise<GeoLookup | null> {
    await this.refreshIfStale();
    let reader: MmdbReader;
    try {
      reader = MmdbReader.open(this.file);
    } catch {
      return null;
    }
    return {
      find: (ip) => {
        try {
          return toGeoLocation(reader.get(ip));
        } catch {
          return null;
        }
      },
      close: () => reader.close(),
    };
  }

  private async refreshIfStale() {
    const age = await stat(this.file).then(
      (s) => Date.now() - s.mtimeMs,
      () => Infinity,
    );
    if (age < MAX_AGE_MS || Date.now() - this.lastFailure < RETRY_AFTER_MS) return;
    try {
      await this.download();
    } catch (err) {
      this.lastFailure = Date.now();
      this.logger.warn(`Base de localização por IP não foi baixada: ${(err as Error).message}`);
    }
  }

  private async download() {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.download`;
    const now = new Date();
    // No começo do mês o arquivo novo pode ainda não ter saído: tenta o do mês anterior.
    const months = [0, 1].map((back) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 7));
    try {
      for (const month of months) {
        const res = await fetch(DB_URL(month), { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (res.status === 404) continue;
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        await pipeline(Readable.fromWeb(res.body as ReadableStream), createGunzip(), createWriteStream(tmp));
        // Arquivo corrompido não substitui o anterior.
        const check = MmdbReader.open(tmp);
        try {
          if (!toGeoLocation(check.get('8.8.8.8'))) throw new Error('base baixada sem localização para 8.8.8.8');
        } finally {
          check.close();
        }
        await rename(tmp, this.file);
        this.logger.log(`Base de localização por IP atualizada (DB-IP ${month})`);
        return;
      }
      throw new Error('arquivo do mês não encontrado');
    } finally {
      await rm(tmp, { force: true });
    }
  }
}
