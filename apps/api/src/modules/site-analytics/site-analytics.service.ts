import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HOME_SECTIONS, normalizeSitePath } from '@g360/shared';
import { platformRootDomain } from '../../common/tenant-host';
import { PrismaService } from '../../prisma/prisma.service';
import { GeoIpService, GeoLocation } from './geoip.service';
import { SiteEventsDto, SiteVisitsQuery, VisitStatus } from './site-analytics.dto';
import { cleanReferrer, parseEntry, parseUserAgent, summarizeBatch, trafficSource } from './site-context';

const TZ = 'America/Sao_Paulo';
const DAY = 86_400_000;
/** Teto de eventos guardados por visita (aba esquecida aberta, script repetindo cliques). */
const MAX_EVENTS_PER_VISIT = 400;
/** Tempo acima disso não conta (a sessão da demo dura uma hora): aba esquecida aberta não distorce a média. */
const ACTIVE_CAP_MS = 60 * 60_000;
/** Teto de caminhos distintos guardados por visita (site e demo). */
const MAX_PATHS = 60;
const GEO_BATCH = 500;
const MAX_PERIOD_DAYS = 400;
const DELETE_BATCH = 5000;

// Etapas do funil, cumulativas: quem entrou na demo também "clicou", mesmo que o clique tenha
// se perdido ou a pessoa tenha aberto /demonstracao direto.
const CONTACTED_SQL = `("whatsappAt" IS NOT NULL OR "formAt" IS NOT NULL)`;
const DEMO_CLICKED_SQL = `("firstDemoClickAt" IS NOT NULL OR "demoStartedAt" IS NOT NULL)`;
const CONTACTED = Prisma.raw(CONTACTED_SQL);
const DEMO_CLICKED = Prisma.raw(DEMO_CLICKED_SQL);
const DEMO_STARTED = Prisma.raw(`"demoStartedAt" IS NOT NULL`);
const DEMO_NAVIGATED = Prisma.raw(`("demoStartedAt" IS NOT NULL AND "demoPathCount" >= 2)`);
const ENGAGED = Prisma.raw(`(${DEMO_CLICKED_SQL} OR ${CONTACTED_SQL} OR "pageViews" >= 2 OR "maxScrollPct" >= 50 OR "activeMs" >= 30000)`);
/** Saiu sem interagir: uma página só, sem clique, rolou menos de um quarto e ficou menos de 15 segundos. */
const BOUNCED = Prisma.raw(`(NOT ${DEMO_CLICKED_SQL} AND NOT ${CONTACTED_SQL} AND "pageViews" <= 1 AND "maxScrollPct" < 25 AND "activeMs" < 15000)`);
const LOCAL_TIME = Prisma.raw(`(("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')`);

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/**
 * Data no SQL bruto como "timestamp" em UTC, o formato das colunas DateTime do Prisma. Um Date
 * passado direto vai como timestamptz e o Postgres o converte pelo fuso da sessão: fora de UTC,
 * período, LEAST e GREATEST deslocariam horas.
 */
const utc = (date: Date) => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

/** Dias (AAAA-MM-DD, horário de Brasília) entre from e to, para a série não pular dias sem visita. */
function dayKeys(from: Date, to: Date): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const keys = new Set<string>();
  for (let t = from.getTime(); t < to.getTime(); t += DAY) keys.add(fmt.format(new Date(t)));
  keys.add(fmt.format(new Date(to.getTime() - 1)));
  return [...keys];
}

/** Junta caminhos novos aos guardados, sem repetir, até o teto. */
function mergePaths(column: string, values: string[]) {
  const col = Prisma.raw(`"${column}"`);
  return Prisma.sql`CASE WHEN cardinality(${col}) >= ${MAX_PATHS} THEN ${col} ELSE ARRAY(SELECT DISTINCT unnest(${col} || ${values}::text[])) END`;
}

const LIST_SELECT = {
  id: true,
  visitorId: true,
  startedAt: true,
  lastSeenAt: true,
  activeMs: true,
  demoMs: true,
  maxScrollPct: true,
  ip: true,
  country: true,
  region: true,
  city: true,
  geoAt: true,
  device: true,
  browser: true,
  os: true,
  isBot: true,
  entryPath: true,
  referrerHost: true,
  source: true,
  utmSource: true,
  utmCampaign: true,
  pageViews: true,
  pages: true,
  sections: true,
  demoClicks: true,
  firstDemoClickAt: true,
  demoStartedAt: true,
  demoErrors: true,
  demoPageViews: true,
  demoPathCount: true,
  demoPaths: true,
  whatsappAt: true,
  formAt: true,
} satisfies Prisma.SiteVisitSelect;

type BreakdownRow = { label: string | null; sub: string | null; visits: number; visitors: number; demo: number; contacts: number };

/**
 * Visitantes do site e da demonstração: cada visita às páginas públicas, com origem,
 * localização aproximada, até onde rolou a página inicial, se abriu a demonstração, por
 * quais áreas dela passou e se chamou a equipe. Os números deixam de fora robôs e
 * navegadores automatizados; quem está logado no sistema nem chega a ser contado.
 */
@Injectable()
export class SiteAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoIpService,
  ) {}

  // ------------------------------------------------------------------ coleta

  async ingest(dto: SiteEventsDto, meta: { ip?: string; userAgent?: string }) {
    const now = Date.now();
    // Hora do servidor: o relógio do navegador pode estar errado; a diferença no envio corrige.
    const skew = now - dto.sentAt;
    const at = (t: number) => new Date(Math.min(now, Math.max(now - DAY, t + skew)));
    // No mesmo milissegundo (página aberta e 1ª seção vista), 1 ms de diferença mantém a ordem do lote na linha do tempo.
    let prev = 0;
    const events = dto.events.map((e) => {
      prev = Math.max(at(e.at).getTime(), prev + 1);
      return { type: e.type, label: e.label?.trim().slice(0, 200) || null, path: normalizeSitePath(e.path), createdAt: new Date(prev) };
    });
    const times = events.map((e) => e.createdAt.getTime());
    const firstAt = new Date(times.length ? Math.min(...times) : now);
    const lastAt = new Date(times.length ? Math.max(...times) : now);

    const existing = await this.prisma.siteVisit.findUnique({ where: { id: dto.visitId }, select: { visitorId: true } });
    if (existing && existing.visitorId !== dto.visitorId) return;
    if (!existing) await this.createVisit(dto, meta, firstAt);

    const s = summarizeBatch(events);
    const sets: Prisma.Sql[] = [
      Prisma.sql`"lastSeenAt" = GREATEST("lastSeenAt", ${utc(lastAt)})`,
      Prisma.sql`"activeMs" = GREATEST("activeMs", ${Math.min(dto.activeMs ?? 0, ACTIVE_CAP_MS)})`,
      Prisma.sql`"demoMs" = GREATEST("demoMs", ${Math.min(dto.demoMs ?? 0, ACTIVE_CAP_MS)})`,
      Prisma.sql`"maxScrollPct" = GREATEST("maxScrollPct", ${dto.maxScrollPct ?? 0})`,
      Prisma.sql`"pageViews" = "pageViews" + ${s.pageViews}`,
      Prisma.sql`"demoClicks" = "demoClicks" + ${s.demoClicks}`,
      Prisma.sql`"demoErrors" = "demoErrors" + ${s.demoErrors}`,
      Prisma.sql`"demoPageViews" = "demoPageViews" + ${s.demoPageViews}`,
      Prisma.sql`"eventCount" = "eventCount" + ${events.length}`,
    ];
    // LEAST ignora NULL: fica a primeira vez, mesmo com lotes chegando fora de ordem.
    if (s.firstDemoClick) sets.push(Prisma.sql`"firstDemoClickAt" = LEAST("firstDemoClickAt", ${utc(s.firstDemoClick)})`);
    if (s.demoStart) sets.push(Prisma.sql`"demoStartedAt" = LEAST("demoStartedAt", ${utc(s.demoStart)})`);
    if (s.whatsapp) sets.push(Prisma.sql`"whatsappAt" = LEAST("whatsappAt", ${utc(s.whatsapp)})`);
    if (s.form) sets.push(Prisma.sql`"formAt" = LEAST("formAt", ${utc(s.form)})`);
    if (s.sections.length) sets.push(Prisma.sql`"sections" = ARRAY(SELECT DISTINCT unnest("sections" || ${s.sections}::text[]))`);
    if (s.pages.length) sets.push(Prisma.sql`"pages" = ${mergePaths('pages', s.pages)}`);
    if (s.demoPaths.length) {
      // Nas duas colunas o SET enxerga a linha antiga: a contagem sai da mesma junção.
      sets.push(Prisma.sql`"demoPaths" = ${mergePaths('demoPaths', s.demoPaths)}`);
      sets.push(Prisma.sql`"demoPathCount" = cardinality(${mergePaths('demoPaths', s.demoPaths)})`);
    }

    const [row] = await this.prisma.$queryRaw<{ eventCount: number }[]>`
      UPDATE "SiteVisit" SET ${Prisma.join(sets, ', ')}
      WHERE id = ${dto.visitId} AND "visitorId" = ${dto.visitorId}
      RETURNING "eventCount"`;
    if (!row || !events.length) return;
    const room = Math.max(0, MAX_EVENTS_PER_VISIT - (row.eventCount - events.length));
    if (room) await this.prisma.siteEvent.createMany({ data: events.slice(0, room).map((e) => ({ ...e, visitId: dto.visitId })) });
  }

  private async createVisit(dto: SiteEventsDto, meta: { ip?: string; userAgent?: string }, startedAt: Date) {
    const ctx = dto.context;
    const ua = parseUserAgent(meta.userAgent, ctx.touch);
    const entry = parseEntry(ctx.entryPath);
    const ref = cleanReferrer(ctx.referrer);
    await this.prisma.siteVisit.createMany({
      data: [
        {
          id: dto.visitId,
          visitorId: dto.visitorId,
          startedAt,
          lastSeenAt: startedAt,
          ip: meta.ip?.slice(0, 64) ?? null,
          // Sem IP não há o que localizar.
          geoAt: meta.ip ? null : new Date(),
          userAgent: meta.userAgent?.slice(0, 400) ?? null,
          device: ua.device,
          browser: ua.browser,
          os: ua.os,
          isBot: ua.bot || ctx.webdriver === true,
          language: ctx.language?.slice(0, 35) ?? null,
          screen: ctx.screen?.slice(0, 20) ?? null,
          timezone: ctx.timezone?.slice(0, 60) ?? null,
          entryPath: entry.path,
          referrer: ref.referrer,
          referrerHost: ref.host,
          source: trafficSource({
            referrerHost: ref.host,
            utmSource: entry.utmSource,
            utmMedium: entry.utmMedium,
            googleClick: entry.googleClick,
            metaClick: entry.metaClick,
            browser: ua.browser,
            rootDomain: platformRootDomain(),
          }),
          utmSource: entry.utmSource,
          utmMedium: entry.utmMedium,
          utmCampaign: entry.utmCampaign,
          utmTerm: entry.utmTerm,
          utmContent: entry.utmContent,
        },
      ],
      // Dois lotes da mesma visita chegando juntos: o segundo só atualiza.
      skipDuplicates: true,
    });
  }

  // ----------------------------------------------------------- rotinas agendadas

  /** Localização aproximada das visitas novas, a partir do IP (base local, sem serviço externo). */
  async resolvePendingGeo() {
    let lookup: Awaited<ReturnType<GeoIpService['open']>> | undefined;
    let resolved = 0;
    try {
      for (let round = 0; round < 20; round++) {
        const pending = await this.prisma.siteVisit.findMany({ where: { geoAt: null }, select: { id: true, ip: true }, orderBy: { startedAt: 'asc' }, take: GEO_BATCH });
        if (!pending.length) break;
        if (lookup === undefined) lookup = await this.geo.open();
        if (!lookup) break;
        // Visitas da mesma cidade numa só atualização.
        const groups = new Map<string, { loc: GeoLocation | null; ids: string[] }>();
        for (const v of pending) {
          const loc = v.ip ? lookup.find(v.ip) : null;
          const key = JSON.stringify(loc);
          const group = groups.get(key) ?? { loc, ids: [] };
          group.ids.push(v.id);
          groups.set(key, group);
        }
        const now = new Date();
        for (const { loc, ids } of groups.values()) {
          await this.prisma.siteVisit.updateMany({ where: { id: { in: ids } }, data: { geoAt: now, country: loc?.country ?? null, region: loc?.region ?? null, city: loc?.city ?? null } });
        }
        resolved += pending.length;
        if (pending.length < GEO_BATCH) break;
      }
    } finally {
      lookup?.close();
    }
    return { resolved };
  }

  /** Retenção: visitas (e seus eventos, em cascata) mais antigas que o corte. */
  async purgeBefore(cutoff: Date) {
    let removed = 0;
    for (;;) {
      const count = await this.prisma.$executeRaw`
        DELETE FROM "SiteVisit" WHERE id IN (SELECT id FROM "SiteVisit" WHERE "startedAt" < ${utc(cutoff)} LIMIT ${DELETE_BATCH})`;
      removed += count;
      if (count < DELETE_BATCH) return removed;
    }
  }

  // ------------------------------------------------------------- portal admin

  private period(q: { from?: Date; to?: Date }) {
    const to = q.to ?? new Date();
    let from = q.from ?? new Date(to.getTime() - 30 * DAY);
    if (from >= to) throw new BadRequestException('A data inicial precisa ser anterior à final');
    if (to.getTime() - from.getTime() > MAX_PERIOD_DAYS * DAY) from = new Date(to.getTime() - MAX_PERIOD_DAYS * DAY);
    return { from, to };
  }

  private breakdown(base: Prisma.Sql, label: Prisma.Sql, opts: { sub?: Prisma.Sql; where?: Prisma.Sql; limit?: number } = {}) {
    return this.prisma.$queryRaw<BreakdownRow[]>`
      SELECT ${label} AS label, ${opts.sub ?? Prisma.sql`NULL::text`} AS sub,
        COUNT(*)::int AS visits,
        COUNT(DISTINCT "visitorId")::int AS visitors,
        COUNT(*) FILTER (WHERE ${DEMO_STARTED})::int AS demo,
        COUNT(*) FILTER (WHERE ${CONTACTED})::int AS contacts
      FROM "SiteVisit" WHERE ${base} ${opts.where ? Prisma.sql`AND ${opts.where}` : Prisma.empty}
      GROUP BY 1, 2 ORDER BY visits DESC, label LIMIT ${opts.limit ?? 12}`;
  }

  async overview(q: { from?: Date; to?: Date }) {
    const { from, to } = this.period(q);
    const base = Prisma.sql`"isBot" = false AND "startedAt" >= ${utc(from)} AND "startedAt" < ${utc(to)}`;
    const inPeriod = Prisma.sql`SELECT id FROM "SiteVisit" WHERE ${base}`;
    const order = [...HOME_SECTIONS];

    const [totalsRows, newRows, bots, pendingGeo, liveNow, daily, heat, sections, deepest, scroll, time] = await Promise.all([
      this.prisma.$queryRaw<Record<string, number>[]>`
        SELECT COUNT(*)::int AS visits,
          COUNT(DISTINCT "visitorId")::int AS visitors,
          COUNT(*) FILTER (WHERE cardinality(sections) > 0)::int AS "homeVisits",
          COUNT(*) FILTER (WHERE ${ENGAGED})::int AS engaged,
          COUNT(*) FILTER (WHERE ${BOUNCED})::int AS bounced,
          COUNT(*) FILTER (WHERE ${DEMO_CLICKED})::int AS "demoClicked",
          COUNT(*) FILTER (WHERE ${DEMO_STARTED})::int AS "demoStarted",
          COUNT(*) FILTER (WHERE ${DEMO_NAVIGATED})::int AS "demoNavigated",
          COUNT(*) FILTER (WHERE "demoErrors" > 0 AND "demoStartedAt" IS NULL)::int AS "demoFailed",
          COUNT(*) FILTER (WHERE ${CONTACTED})::int AS contacted,
          COUNT(*) FILTER (WHERE ${CONTACTED} AND ${DEMO_STARTED})::int AS "contactedAfterDemo",
          COUNT(*) FILTER (WHERE "whatsappAt" IS NOT NULL)::int AS whatsapp,
          COUNT(*) FILTER (WHERE "formAt" IS NOT NULL)::int AS forms,
          COALESCE(AVG("activeMs"), 0)::float AS "avgActiveMs",
          COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY "activeMs"), 0)::float AS "medianActiveMs",
          COALESCE(AVG("maxScrollPct") FILTER (WHERE cardinality(sections) > 0), 0)::float AS "avgScrollPct",
          COALESCE(AVG("demoMs") FILTER (WHERE ${DEMO_STARTED}), 0)::float AS "avgDemoMs",
          COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY "demoMs") FILTER (WHERE ${DEMO_STARTED}), 0)::float AS "medianDemoMs",
          COALESCE(AVG("demoPathCount") FILTER (WHERE ${DEMO_STARTED}), 0)::float AS "avgDemoPages"
        FROM "SiteVisit" WHERE ${base}`,
      // Navegador novo = a primeira visita dele (em todo o histórico guardado) caiu no período.
      this.prisma.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM (
          SELECT "visitorId" FROM "SiteVisit"
          WHERE "isBot" = false AND "visitorId" IN (SELECT "visitorId" FROM "SiteVisit" WHERE ${base})
          GROUP BY "visitorId" HAVING MIN("startedAt") >= ${utc(from)}
        ) x`,
      this.prisma.siteVisit.count({ where: { isBot: true, startedAt: { gte: from, lt: to } } }),
      this.prisma.siteVisit.count({ where: { geoAt: null } }),
      this.prisma.siteVisit.count({ where: { isBot: false, lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) } } }),
      this.prisma.$queryRaw<{ day: string; visits: number; visitors: number; demo: number; contacts: number }[]>`
        SELECT to_char(${LOCAL_TIME}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS visits, COUNT(DISTINCT "visitorId")::int AS visitors,
          COUNT(*) FILTER (WHERE ${DEMO_STARTED})::int AS demo, COUNT(*) FILTER (WHERE ${CONTACTED})::int AS contacts
        FROM "SiteVisit" WHERE ${base} GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ dow: number; hour: number; visits: number }[]>`
        SELECT EXTRACT(ISODOW FROM ${LOCAL_TIME})::int AS dow, EXTRACT(HOUR FROM ${LOCAL_TIME})::int AS hour, COUNT(*)::int AS visits
        FROM "SiteVisit" WHERE ${base} GROUP BY 1, 2`,
      this.prisma.$queryRaw<{ section: string; visits: number }[]>`
        SELECT s AS section, COUNT(*)::int AS visits FROM "SiteVisit", unnest(sections) AS s WHERE ${base} GROUP BY 1`,
      // Quem não clicou na demonstração: a seção mais abaixo da página inicial que chegou a ver.
      this.prisma.$queryRaw<{ section: string | null; visits: number }[]>`
        SELECT (SELECT s FROM unnest(sections) AS s ORDER BY array_position(${order}::text[], s) DESC NULLS LAST LIMIT 1) AS section, COUNT(*)::int AS visits
        FROM "SiteVisit" WHERE ${base} AND NOT ${DEMO_CLICKED} AND cardinality(sections) > 0 GROUP BY 1`,
      this.prisma.$queryRaw<{ bucket: number; visits: number }[]>`
        SELECT CASE WHEN "maxScrollPct" < 25 THEN 0 WHEN "maxScrollPct" < 50 THEN 25 WHEN "maxScrollPct" < 75 THEN 50 WHEN "maxScrollPct" < 100 THEN 75 ELSE 100 END AS bucket,
          COUNT(*)::int AS visits
        FROM "SiteVisit" WHERE ${base} AND NOT ${DEMO_CLICKED} AND cardinality(sections) > 0 GROUP BY 1`,
      this.prisma.$queryRaw<{ bucket: number; visits: number }[]>`
        SELECT CASE WHEN "activeMs" < 10000 THEN 0 WHEN "activeMs" < 30000 THEN 10 WHEN "activeMs" < 60000 THEN 30 WHEN "activeMs" < 180000 THEN 60 ELSE 180 END AS bucket,
          COUNT(*)::int AS visits
        FROM "SiteVisit" WHERE ${base} AND NOT ${DEMO_CLICKED} GROUP BY 1`,
    ]);

    const [areas, demoPages, demoDepth, demoTime, pages, clicks, demoErrors] = await Promise.all([
      this.prisma.$queryRaw<{ area: string; visits: number }[]>`
        SELECT split_part(p, '/', 2) AS area, COUNT(DISTINCT id)::int AS visits
        FROM "SiteVisit", unnest("demoPaths") AS p WHERE ${base} GROUP BY 1 ORDER BY visits DESC, área`,
      this.prisma.$queryRaw<{ path: string; visits: number }[]>`
        SELECT p AS path, COUNT(*)::int AS visits FROM "SiteVisit", unnest("demoPaths") AS p WHERE ${base}
        GROUP BY 1 ORDER BY visits DESC, path LIMIT 20`,
      this.prisma.$queryRaw<{ bucket: number; visits: number }[]>`
        SELECT CASE WHEN "demoPathCount" <= 1 THEN 1 WHEN "demoPathCount" <= 3 THEN 2 WHEN "demoPathCount" <= 6 THEN 4 ELSE 7 END AS bucket,
          COUNT(*)::int AS visits
        FROM "SiteVisit" WHERE ${base} AND ${DEMO_STARTED} GROUP BY 1`,
      this.prisma.$queryRaw<{ bucket: number; visits: number }[]>`
        SELECT CASE WHEN "demoMs" < 60000 THEN 0 WHEN "demoMs" < 180000 THEN 1 WHEN "demoMs" < 600000 THEN 3 ELSE 10 END AS bucket,
          COUNT(*)::int AS visits
        FROM "SiteVisit" WHERE ${base} AND ${DEMO_STARTED} GROUP BY 1`,
      this.prisma.$queryRaw<{ path: string; visits: number }[]>`
        SELECT p AS path, COUNT(*)::int AS visits FROM "SiteVisit", unnest(pages) AS p WHERE ${base}
        GROUP BY 1 ORDER BY visits DESC, path LIMIT 15`,
      this.prisma.$queryRaw<{ type: string; label: string; clicks: number; visits: number }[]>`
        SELECT type, COALESCE(label, '') AS label, COUNT(*)::int AS clicks, COUNT(DISTINCT "visitId")::int AS visits
        FROM "SiteEvent" WHERE type IN ('demo_click', 'login_click', 'trial_click', 'whatsapp_click', 'form_submit') AND "visitId" IN (${inPeriod})
        GROUP BY 1, 2 ORDER BY clicks DESC LIMIT 60`,
      this.prisma.$queryRaw<{ message: string; times: number; visits: number }[]>`
        SELECT COALESCE(label, '(sem mensagem)') AS message, COUNT(*)::int AS times, COUNT(DISTINCT "visitId")::int AS visits
        FROM "SiteEvent" WHERE type = 'demo_error' AND "visitId" IN (${inPeriod})
        GROUP BY 1 ORDER BY times DESC LIMIT 10`,
    ]);

    const [sources, campaigns, referrers, entryPages, states, cities, countries, devices, browsers, systems] = await Promise.all([
      this.breakdown(base, Prisma.sql`source`),
      this.breakdown(base, Prisma.sql`"utmCampaign"`, { sub: Prisma.sql`"utmSource"`, where: Prisma.sql`"utmCampaign" IS NOT NULL` }),
      this.breakdown(base, Prisma.sql`"referrerHost"`, { where: Prisma.sql`"referrerHost" IS NOT NULL` }),
      this.breakdown(base, Prisma.sql`split_part("entryPath", '?', 1)`),
      this.breakdown(base, Prisma.sql`region`, { where: Prisma.sql`country = 'BR'`, limit: 27 }),
      this.breakdown(base, Prisma.sql`city`, { sub: Prisma.sql`region`, where: Prisma.sql`city IS NOT NULL`, limit: 15 }),
      this.breakdown(base, Prisma.sql`country`),
      this.breakdown(base, Prisma.sql`device`),
      this.breakdown(base, Prisma.sql`browser`),
      this.breakdown(base, Prisma.sql`os`),
    ]);

    const t = totalsRows[0] ?? {};
    const visits = n(t.visits);
    const visitors = n(t.visitors);
    const newVisitors = Math.min(visitors, n(newRows[0]?.c));
    const demoClicked = n(t.demoClicked);
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const sectionCount = new Map(sections.map((s) => [s.section, s.visits]));
    return {
      period: { from, to },
      liveNow,
      totals: {
        visits,
        visitors,
        newVisitors,
        returningVisitors: visitors - newVisitors,
        homeVisits: n(t.homeVisits),
        engaged: n(t.engaged),
        bounced: n(t.bounced),
        demoClicked,
        demoStarted: n(t.demoStarted),
        demoNavigated: n(t.demoNavigated),
        demoFailed: n(t.demoFailed),
        contacted: n(t.contacted),
        contactedAfterDemo: n(t.contactedAfterDemo),
        whatsapp: n(t.whatsapp),
        forms: n(t.forms),
        avgActiveMs: Math.round(n(t.avgActiveMs)),
        medianActiveMs: Math.round(n(t.medianActiveMs)),
        avgScrollPct: Math.round(n(t.avgScrollPct)),
        avgDemoMs: Math.round(n(t.avgDemoMs)),
        medianDemoMs: Math.round(n(t.medianDemoMs)),
        avgDemoPages: Math.round(n(t.avgDemoPages) * 10) / 10,
        bots,
        pendingGeo,
      },
      daily: dayKeys(from, to).map((day) => {
        const d = byDay.get(day);
        return { day, visits: d?.visits ?? 0, visitors: d?.visitors ?? 0, demo: d?.demo ?? 0, contacts: d?.contacts ?? 0 };
      }),
      heatmap: heat,
      sections: order.map((section) => ({ section, visits: sectionCount.get(section) ?? 0 })),
      noDemo: {
        total: visits - demoClicked,
        deepest: deepest.map((d) => ({ section: d.section, visits: d.visits })),
        scroll: scroll.sort((a, b) => a.bucket - b.bucket),
        time: time.sort((a, b) => a.bucket - b.bucket),
      },
      demo: {
        areas,
        pages: demoPages,
        depth: demoDepth.sort((a, b) => a.bucket - b.bucket),
        time: demoTime.sort((a, b) => a.bucket - b.bucket),
        sources: clicks.filter((c) => c.type === 'demo_click'),
        errors: demoErrors,
      },
      pages,
      clicks: clicks.filter((c) => c.type !== 'demo_click'),
      breakdowns: { sources, campaigns, referrers, entryPages, states, cities, countries, devices, browsers, systems },
    };
  }

  async visits(q: SiteVisitsQuery) {
    const { from, to } = this.period(q);
    // Mesmas regras do funil: sem contato, a visita é classificada pelo ponto mais fundo da demo.
    const quiet: Prisma.SiteVisitWhereInput = { whatsappAt: null, formAt: null };
    const noDemo: Prisma.SiteVisitWhereInput = { demoStartedAt: null, firstDemoClickAt: null };
    const status: Record<VisitStatus, Prisma.SiteVisitWhereInput> = {
      contacted: { OR: [{ whatsappAt: { not: null } }, { formAt: { not: null } }] },
      demo_navigated: { ...quiet, demoStartedAt: { not: null }, demoPathCount: { gte: 2 } },
      demo_entered: { ...quiet, demoStartedAt: { not: null }, demoPathCount: { lt: 2 } },
      demo_clicked: { ...quiet, demoStartedAt: null, firstDemoClickAt: { not: null } },
      no_demo: noDemo,
      bounced: { ...quiet, ...noDemo, pageViews: { lte: 1 }, maxScrollPct: { lt: 25 }, activeMs: { lt: 15000 } },
    };
    const search = q.search?.trim();
    const and: Prisma.SiteVisitWhereInput[] = [];
    if (q.status) and.push(status[q.status]);
    if (search) {
      and.push({
        OR: [
          { ip: { startsWith: search } },
          { city: { contains: search, mode: 'insensitive' } },
          { utmCampaign: { contains: search, mode: 'insensitive' } },
          { referrerHost: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.SiteVisitWhereInput = {
      startedAt: { gte: from, lt: to },
      ...(q.bots === 'true' ? {} : { isBot: false }),
      ...(q.source ? { source: q.source } : {}),
      ...(q.region ? { region: q.region } : {}),
      ...(q.device ? { device: q.device } : {}),
      ...(and.length ? { AND: and } : {}),
    };
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const [rows, total] = await Promise.all([
      this.prisma.siteVisit.findMany({ where, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize, select: LIST_SELECT }),
      this.prisma.siteVisit.count({ where }),
    ]);
    const visitorIds = [...new Set(rows.map((r) => r.visitorId))];
    const perVisitor = visitorIds.length
      ? await this.prisma.siteVisit.groupBy({ by: ['visitorId'], where: { visitorId: { in: visitorIds } }, _count: { _all: true } })
      : [];
    const visitsOf = new Map(perVisitor.map((v) => [v.visitorId, v._count._all]));
    return { rows: rows.map((r) => ({ ...r, visitorVisits: visitsOf.get(r.visitorId) ?? 1 })), total, page, pageSize };
  }

  async visit(id: string) {
    const v = await this.prisma.siteVisit.findUnique({
      where: { id },
      include: { events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, type: true, label: true, path: true, createdAt: true } } },
    });
    if (!v) throw new NotFoundException('Visita não encontrada');
    const [history, contacts] = await Promise.all([
      this.prisma.siteVisit.findMany({ where: { visitorId: v.visitorId }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: 30, select: LIST_SELECT }),
      // Formulários enviados nesta visita: quem é a pessoa, quando ela se identificou.
      this.prisma.publicContactMessage.findMany({
        where: { siteVisitId: v.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, company: true, role: true, email: true, phone: true, requestType: true, createdAt: true },
      }),
    ]);
    return { ...v, history, contacts };
  }
}
