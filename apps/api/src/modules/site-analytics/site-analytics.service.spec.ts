import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SiteAnalyticsService } from './site-analytics.service';

const VISITOR = '0b0f6c1e-5d2a-4c7b-9e8f-1a2b3c4d5e6f';
const VISIT = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const MOBILE = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

function setup(opts: { existing?: { visitorId: string } | null; eventCount?: number } = {}) {
  const prisma = {
    siteVisit: {
      findUnique: vi.fn().mockResolvedValue(opts.existing ?? null),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    siteEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $queryRaw: vi.fn().mockResolvedValue([{ eventCount: opts.eventCount ?? 3 }]),
  };
  return { prisma, service: new SiteAnalyticsService(prisma as never, {} as never) };
}

function batch(events: { type: string; label?: string; path?: string }[], extra: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    visitorId: VISITOR,
    visitId: VISIT,
    sentAt: now,
    context: { entryPath: '/?utm_source=linkedin&utm_campaign=bsc&fbclid=abc', referrer: 'https://www.linkedin.com/feed/', screen: '412x915', touch: true },
    events: events.map((e, i) => ({ ...e, at: now - 1000 + i })),
    activeMs: 42_000,
    demoMs: 12_000,
    ...extra,
  } as never;
}

/** Texto do UPDATE montado pelo serviço (com $1, $2...). */
const updateSql = (prisma: ReturnType<typeof setup>['prisma']) => {
  const [strings, ...values] = prisma.$queryRaw.mock.calls[0];
  return Prisma.sql(strings, ...values).text;
};

describe('SiteAnalyticsService.ingest', () => {
  it('cria a visita nova com origem, aparelho e página de entrada sem identificador de clique', async () => {
    const { prisma, service } = setup();
    await service.ingest(batch([{ type: 'page_view', path: '/' }, { type: 'demo_click', label: 'home_hero', path: '/' }, { type: 'demo_start', path: '/' }]), { ip: '200.160.2.3', userAgent: MOBILE });

    expect(prisma.siteVisit.createMany).toHaveBeenCalledOnce();
    const [{ data, skipDuplicates }] = prisma.siteVisit.createMany.mock.calls[0];
    expect(skipDuplicates).toBe(true);
    expect(data[0]).toMatchObject({
      id: VISIT,
      visitorId: VISITOR,
      ip: '200.160.2.3',
      geoAt: null,
      device: 'mobile',
      browser: 'Chrome',
      isBot: false,
      source: 'linkedin',
      utmCampaign: 'bsc',
      entryPath: '/?utm_source=linkedin&utm_campaign=bsc',
      referrerHost: 'linkedin.com',
    });
    const sql = updateSql(prisma);
    expect(sql).toContain('UPDATE "SiteVisit" SET');
    expect(sql).toContain('"firstDemoClickAt" = LEAST("firstDemoClickAt"');
    expect(sql).toContain('"demoStartedAt" = LEAST("demoStartedAt"');
    expect(sql).not.toContain('"demoPathCount"');
    const events = prisma.siteEvent.createMany.mock.calls[0][0].data;
    expect(events.map((e: { type: string }) => e.type)).toEqual(['page_view', 'demo_click', 'demo_start']);
    expect(events.every((e: { visitId: string }) => e.visitId === VISIT)).toBe(true);
  });

  it('páginas da demonstração atualizam caminhos e contagem; ids viram :id', async () => {
    const { prisma, service } = setup({ existing: { visitorId: VISITOR } });
    await service.ingest(batch([{ type: 'demo_page', path: '/meu-dia' }, { type: 'demo_page', path: '/indicators/3f2a9c1e-1b2c-4d5e-8f90-123456789abc' }]), { ip: '200.160.2.3', userAgent: MOBILE });

    expect(prisma.siteVisit.createMany).not.toHaveBeenCalled();
    const sql = updateSql(prisma);
    expect(sql).toContain('"demoPaths" = CASE WHEN cardinality("demoPaths")');
    expect(sql).toContain('"demoPathCount" = cardinality(');
    const events = prisma.siteEvent.createMany.mock.calls[0][0].data;
    expect(events.map((e: { path: string }) => e.path)).toEqual(['/meu-dia', '/indicators/:id']);
  });

  it('ignora o lote de outro navegador com o mesmo id de visita', async () => {
    const { prisma, service } = setup({ existing: { visitorId: 'outro-navegador' } });
    await service.ingest(batch([{ type: 'page_view', path: '/' }]), { ip: '200.160.2.3', userAgent: MOBILE });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.siteEvent.createMany).not.toHaveBeenCalled();
  });

  it('guarda no máximo 400 eventos por visita', async () => {
    const { prisma, service } = setup({ existing: { visitorId: VISITOR }, eventCount: 402 });
    await service.ingest(batch([{ type: 'page_view', path: '/' }, { type: 'page_view', path: '/modulos' }]), { ip: '200.160.2.3', userAgent: MOBILE });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(prisma.siteEvent.createMany).not.toHaveBeenCalled();
  });

  it('robô entra marcado e visita sem IP não espera localização', async () => {
    const { prisma, service } = setup();
    await service.ingest(batch([{ type: 'page_view', path: '/' }]), { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
    expect(prisma.siteVisit.createMany.mock.calls[0][0].data[0]).toMatchObject({ isBot: true, ip: null, geoAt: expect.any(Date) });
  });
});

describe('SiteAnalyticsService (portal)', () => {
  it('retorna as áreas da demonstração usando o mesmo alias no agrupamento e na ordenação', async () => {
    const { prisma, service } = setup();
    const areas = [{ area: 'indicators', visits: 2 }, { area: 'meu-dia', visits: 1 }];
    prisma.$queryRaw.mockImplementation(async (strings, ...values) => {
      const query = Prisma.sql(strings, ...values).text;
      if (query.includes("split_part(p, '/', 2) AS area")) {
        expect(query).toMatch(/ORDER BY visits DESC, area\s*$/);
        return areas;
      }
      return [];
    });

    const result = await service.overview({ from: new Date('2026-10-04T03:00:00Z'), to: new Date('2026-11-03T03:00:00Z') });

    expect(result.demo.areas).toEqual(areas);
    expect(result.daily).toHaveLength(30);
  });

  it('recusa período com início depois do fim', async () => {
    const { service } = setup();
    await expect(service.overview({ from: new Date('2026-10-31'), to: new Date('2026-10-01') })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lista visitas com o filtro de resultado e a busca juntos', async () => {
    const { prisma, service } = setup();
    const result = await service.visits({ status: 'no_demo', search: 'Goiânia', page: 2, pageSize: 10 });
    const args = prisma.siteVisit.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ isBot: false, AND: [{ demoStartedAt: null, firstDemoClickAt: null }, { OR: expect.any(Array) }] });
    expect(args).toMatchObject({ skip: 10, take: 10 });
    expect(result).toEqual({ rows: [], total: 0, page: 2, pageSize: 10 });
  });
});
