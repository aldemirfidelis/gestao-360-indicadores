/**
 * Conectores de saída (outbound) para sistemas externos.
 *
 * `GenericRestConnector` é totalmente funcional (REST + auth configurável). SAP/Apdata/SE Suite
 * estendem o genérico com convenções padrão de cada fornecedor — ficam operacionais assim que o
 * endpoint/credenciais forem informados na configuração do conector.
 *
 * Nenhuma credencial é logada. Usa `fetch` global (Node 18+).
 */

export interface ConnectorCredentials {
  apiKey?: string;
  apiKeyHeader?: string; // header onde enviar a apiKey (default X-Api-Key)
  bearerToken?: string;
  username?: string;
  password?: string;
  [k: string]: unknown;
}

export interface ConnectorConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  /** Mapa de recurso → caminho. Ex.: { test: '/health', 'push:results': '/results', 'pull:results': '/results' } */
  endpoints?: Record<string, string>;
  timeoutMs?: number;
  [k: string]: unknown;
}

export interface ConnectorContext {
  baseUrl: string | null;
  authType: string; // NONE | API_KEY | BEARER | BASIC | OAUTH2
  credentials: ConnectorCredentials;
  config: ConnectorConfig;
}

export interface ConnectorResult {
  ok: boolean;
  httpStatus?: number;
  message?: string;
  data?: unknown;
}

export interface ExternalConnector {
  testConnection(): Promise<ConnectorResult>;
  push(resource: string, items: unknown[]): Promise<ConnectorResult>;
  pull(resource: string): Promise<ConnectorResult>;
}

export class GenericRestConnector implements ExternalConnector {
  constructor(protected readonly ctx: ConnectorContext) {}

  /** Defaults do provedor (sobrescrito pelos templates). */
  protected defaultHeaders(): Record<string, string> {
    return {};
  }

  protected authHeaders(): Record<string, string> {
    const { authType, credentials } = this.ctx;
    const h: Record<string, string> = {};
    if (authType === 'API_KEY' && credentials.apiKey) {
      h[credentials.apiKeyHeader || 'X-Api-Key'] = String(credentials.apiKey);
    } else if (authType === 'BEARER' && credentials.bearerToken) {
      h['Authorization'] = `Bearer ${credentials.bearerToken}`;
    } else if (authType === 'BASIC' && credentials.username) {
      const token = Buffer.from(`${credentials.username}:${credentials.password ?? ''}`).toString('base64');
      h['Authorization'] = `Basic ${token}`;
    }
    return h;
  }

  protected url(resource: string): string {
    const base = (this.ctx.baseUrl || this.ctx.config.baseUrl || '').replace(/\/$/, '');
    const path = this.ctx.config.endpoints?.[resource] ?? `/${resource}`;
    if (/^https?:\/\//i.test(path)) return path;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  protected async request(method: string, resource: string, body?: unknown): Promise<ConnectorResult> {
    const base = this.ctx.baseUrl || this.ctx.config.baseUrl;
    if (!base) return { ok: false, message: 'baseUrl não configurada para este conector.' };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.ctx.config.timeoutMs ?? 15_000);
    try {
      const res = await fetch(this.url(resource), {
        method,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...this.defaultHeaders(),
          ...(this.ctx.config.headers ?? {}),
          ...this.authHeaders(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text().catch(() => '');
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        /* mantém texto */
      }
      return {
        ok: res.ok,
        httpStatus: res.status,
        message: res.ok ? 'OK' : `HTTP ${res.status}`,
        data,
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message?.slice(0, 200) ?? 'Falha na requisição' };
    } finally {
      clearTimeout(timeout);
    }
  }

  testConnection(): Promise<ConnectorResult> {
    return this.request('GET', 'test');
  }

  push(resource: string, items: unknown[]): Promise<ConnectorResult> {
    return this.request('POST', `push:${resource}`, { items });
  }

  pull(resource: string): Promise<ConnectorResult> {
    return this.request('GET', `pull:${resource}`);
  }
}

/** SAP (ex.: OData/S/4HANA via REST). Defaults: aceita JSON; auth tipicamente BASIC/OAUTH2. */
export class SapConnector extends GenericRestConnector {
  protected defaultHeaders(): Record<string, string> {
    return { 'x-integration-provider': 'gestao360-sap' };
  }
}

/** Apdata (RH/folha). Default API_KEY por header. */
export class ApdataConnector extends GenericRestConnector {
  protected defaultHeaders(): Record<string, string> {
    return { 'x-integration-provider': 'gestao360-apdata' };
  }
}

/** SoftExpert SE Suite (BPM/Qualidade). */
export class SeSuiteConnector extends GenericRestConnector {
  protected defaultHeaders(): Record<string, string> {
    return { 'x-integration-provider': 'gestao360-sesuite' };
  }
}

export function makeConnector(provider: string, ctx: ConnectorContext): ExternalConnector {
  switch (provider) {
    case 'SAP':
      return new SapConnector(ctx);
    case 'APDATA':
      return new ApdataConnector(ctx);
    case 'SESUITE':
      return new SeSuiteConnector(ctx);
    case 'REST_GENERIC':
    case 'WEBHOOK':
    default:
      return new GenericRestConnector(ctx);
  }
}
