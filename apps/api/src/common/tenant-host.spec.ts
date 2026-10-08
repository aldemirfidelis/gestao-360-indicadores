import { describe, expect, it } from 'vitest';
import { isPlatformSiteHost, subdomainFromHost } from './tenant-host';

const ROOT = 'gestao360.org';

describe('isPlatformSiteHost', () => {
  it('libera o apex, www e collabora (sites do Caddyfile)', () => {
    expect(isPlatformSiteHost('gestao360.org', ROOT)).toBe(true);
    expect(isPlatformSiteHost('www.gestao360.org', ROOT)).toBe(true);
    expect(isPlatformSiteHost('collabora.gestao360.org', ROOT)).toBe(true);
    expect(isPlatformSiteHost('WWW.Gestao360.org:443', ROOT)).toBe(true);
  });

  it('nao libera tenants, outros reservados, multi-nivel nem dominios de fora', () => {
    expect(isPlatformSiteHost('goiasa.gestao360.org', ROOT)).toBe(false);
    expect(isPlatformSiteHost('admin.gestao360.org', ROOT)).toBe(false);
    expect(isPlatformSiteHost('a.www.gestao360.org', ROOT)).toBe(false);
    expect(isPlatformSiteHost('www.gestao360.org.evil.com', ROOT)).toBe(false);
    expect(isPlatformSiteHost('evilgestao360.org', ROOT)).toBe(false);
    expect(isPlatformSiteHost('', ROOT)).toBe(false);
    expect(isPlatformSiteHost(null, ROOT)).toBe(false);
  });
});

describe('subdomainFromHost', () => {
  it('extrai o slug do tenant e ignora apex e reservados', () => {
    expect(subdomainFromHost('goiasa.gestao360.org', ROOT)).toBe('goiasa');
    expect(subdomainFromHost('gestao360.org', ROOT)).toBeNull();
    expect(subdomainFromHost('www.gestao360.org', ROOT)).toBeNull();
    expect(subdomainFromHost('collabora.gestao360.org', ROOT)).toBeNull();
  });
});
