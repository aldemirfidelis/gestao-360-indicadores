import { describe, expect, it } from 'vitest';
import { nextSteps, portalCounters, profileCompletion } from './progress';
import type { PortalData, Profile } from './types';

const EMPTY: PortalData = { profile: null, applications: [], documents: [], dataRequests: [], offers: [], preAdmissions: [] };

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'c1', email: 'a@b.com', name: 'Aldemir', phone: null, headline: null, city: null,
    linkedinUrl: null, portfolioUrl: null, profileData: null, emailVerifiedAt: null, ...overrides,
  };
}

function offer(overrides: Partial<PortalData['offers'][number]> = {}) {
  return {
    id: 'o1', status: 'SENT', revision: 1, salaryAmountCents: 500000, currency: 'BRL',
    startDate: null, expiresAt: null, acceptedAt: null, declinedAt: null,
    application: { posting: { title: 'Gestor', slug: 'gestor', city: null, workMode: null } },
    ...overrides,
  };
}

function preAdmission(documents: PortalData['preAdmissions'][number]['documents'], extra: Partial<PortalData['preAdmissions'][number]> = {}) {
  return {
    id: 'p1', status: 'IN_DOCUMENTS', admissionTargetDate: null,
    application: { posting: { title: 'Gestor', slug: 'gestor' } },
    documents, ...extra,
  };
}

function preDoc(overrides: Partial<PortalData['preAdmissions'][number]['documents'][number]> = {}) {
  return { id: 'd1', kind: 'RG', title: 'RG', required: true, status: 'PENDING', reviewNote: null, candidateDocumentId: null, ...overrides };
}

describe('profileCompletion', () => {
  it('perfil vazio começa em zero e lista o que falta', () => {
    const result = profileCompletion(profile());
    expect(result.percent).toBe(0);
    expect(result.missing).toContain('Telefone');
    expect(result.missing).toContain('Experiências');
  });

  it('sem perfil carregado não quebra', () => {
    expect(profileCompletion(null).percent).toBe(0);
  });

  it('conta campos preenchidos, inclusive listas do profileData', () => {
    const result = profileCompletion(profile({
      phone: '64981009108',
      city: 'Goiânia',
      headline: 'Gestor administrativo',
      profileData: { about: 'Trajetória', skills: ['Excel'], experiences: [{ role: 'Gestor' }], education: [{ course: 'ADM' }], availabilityToStart: 'Imediata' },
    }));
    expect(result.filled).toBe(8);
    expect(result.percent).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it('lista vazia não conta como preenchida', () => {
    expect(profileCompletion(profile({ profileData: { skills: [], experiences: [] } })).percent).toBe(0);
  });

  it('espaço em branco não conta como preenchido', () => {
    expect(profileCompletion(profile({ phone: '   ' })).filled).toBe(0);
  });
});

describe('nextSteps', () => {
  it('portal zerado ainda pede currículo', () => {
    const steps = nextSteps(EMPTY);
    expect(steps.map((s) => s.id)).toEqual(['missing-cv']);
  });

  it('proposta enviada vira a primeira ação, com o prazo', () => {
    const steps = nextSteps({ ...EMPTY, offers: [offer({ expiresAt: '2026-08-10T12:00:00.000Z' })] });
    expect(steps[0].id).toBe('offer-o1');
    expect(steps[0].tone).toBe('action');
    expect(steps[0].description).toContain('10/08/2026');
  });

  it('proposta já respondida não gera ação', () => {
    expect(nextSteps({ ...EMPTY, offers: [offer({ status: 'ACCEPTED' })] }).some((s) => s.id.startsWith('offer-'))).toBe(false);
  });

  it('documento reprovado pede reenvio e nomeia o documento', () => {
    const steps = nextSteps({ ...EMPTY, preAdmissions: [preAdmission([preDoc({ status: 'REJECTED', title: 'Comprovante de residência' })])] });
    const step = steps.find((s) => s.id === 'pre-rejected-p1');
    expect(step?.tone).toBe('warning');
    expect(step?.description).toContain('Comprovante de residência');
  });

  it('documento opcional pendente não cobra o candidato', () => {
    const steps = nextSteps({ ...EMPTY, preAdmissions: [preAdmission([preDoc({ required: false })])] });
    expect(steps.some((s) => s.id.startsWith('pre-pending'))).toBe(false);
  });

  it('exame agendado aparece como informação; com ASO emitido, some', () => {
    const appointment = { id: 'a1', status: 'SCHEDULED', scheduledAt: '2026-08-01T13:30:00.000Z', location: 'Clínica X', providerName: null, instructions: null };
    const withExam = nextSteps({ ...EMPTY, preAdmissions: [preAdmission([], { occupationalExamRequests: [{ id: 'e1', status: 'SCHEDULED', examType: 'ADMISSIONAL', dueAt: null, requestedAt: '', appointment }] })] });
    expect(withExam.find((s) => s.id === 'exam-e1')?.tone).toBe('info');

    const done = nextSteps({ ...EMPTY, preAdmissions: [preAdmission([], { occupationalExamRequests: [{ id: 'e1', status: 'DONE', examType: 'ADMISSIONAL', dueAt: null, requestedAt: '', appointment, asoRecord: { id: 'r1', result: 'APTO', examDate: '', validUntil: null } }] })] });
    expect(done.some((s) => s.id === 'exam-e1')).toBe(false);
  });

  it('currículo enviado tira a cobrança', () => {
    const cv = { id: 'doc1', kind: 'CV', fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 100, applicationId: null, createdAt: '' };
    expect(nextSteps({ ...EMPTY, documents: [cv] }).some((s) => s.id === 'missing-cv')).toBe(false);
  });

  it('perfil quase completo não vira pendência', () => {
    const full = profile({
      phone: '64981009108', city: 'Goiânia', headline: 'Gestor',
      profileData: { about: 'x', skills: ['a'], experiences: [{ role: 'r' }], education: [{ course: 'c' }], availabilityToStart: 'já' },
    });
    expect(nextSteps({ ...EMPTY, profile: full }).some((s) => s.id === 'profile-incomplete')).toBe(false);
    expect(nextSteps({ ...EMPTY, profile: profile() }).some((s) => s.id === 'profile-incomplete')).toBe(true);
  });

  it('proposta vem antes de documento reprovado, que vem antes do currículo', () => {
    const steps = nextSteps({
      ...EMPTY,
      offers: [offer()],
      preAdmissions: [preAdmission([preDoc({ status: 'REJECTED' })])],
    });
    expect(steps.map((s) => s.id)).toEqual(['offer-o1', 'pre-rejected-p1', 'missing-cv']);
  });
});

describe('portalCounters', () => {
  it('soma propostas abertas e documentos cobrados no marcador de candidaturas', () => {
    const counters = portalCounters({
      ...EMPTY,
      applications: [
        { id: 'a1', status: 'ACTIVE', appliedAt: '', stage: null, posting: { title: 'x', slug: 'x', city: null, workMode: null, company: null }, rejectionReason: null },
        { id: 'a2', status: 'REJECTED', appliedAt: '', stage: null, posting: { title: 'y', slug: 'y', city: null, workMode: null, company: null }, rejectionReason: null },
      ],
      offers: [offer()],
      preAdmissions: [preAdmission([preDoc({ status: 'REJECTED' }), preDoc({ id: 'd2', status: 'APPROVED' })])],
    });
    expect(counters.activeApplications).toBe(1);
    expect(counters.openOffers).toBe(1);
    expect(counters.pendingDocuments).toBe(1);
    expect(counters.applicationsBadge).toBe(2);
  });
});
