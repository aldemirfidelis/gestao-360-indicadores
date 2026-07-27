'use client';

import type { ChangeEvent } from 'react';
import Link from 'next/link';
import { BriefcaseBusiness, CalendarClock, FileUp, HandCoins, HeartPulse, MapPin, XCircle } from 'lucide-react';
import { ASO_RESULT, ASO_STATUS, metaOf } from '@/lib/recruitment/labels';
import { APPLICATION_STATUS, DOCUMENT_STATUS, EXAM_TYPE, OFFER_STATUS, PRE_ADMISSION_STATUS, status, text } from '@/lib/candidate/labels';
import type { Application, CandidateDocument, Offer, PreAdmission, PreAdmissionDocument } from '@/lib/candidate/types';
import { Button, Card, CardTitle, EmptyState, Pill, formatDate, formatDateTime, formatMoney } from './ui';

/**
 * Tudo que diz respeito ao processo seletivo, na ordem em que importa para o
 * candidato: proposta a responder → admissão em andamento → candidaturas.
 *
 * Antes proposta, pré-admissão e candidaturas eram três painéis soltos em
 * colunas diferentes; quem estava sendo contratado não via a sequência.
 */
export function ApplicationsSection({
  applications,
  offers,
  preAdmissions,
  documents,
  busy,
  vacanciesHref,
  publicSuffix,
  onWithdraw,
  onDecideOffer,
  onAttachPreAdmissionFile,
  onSelectExistingDocument,
}: {
  applications: Application[];
  offers: Offer[];
  preAdmissions: PreAdmission[];
  documents: CandidateDocument[];
  busy: boolean;
  vacanciesHref: string;
  publicSuffix: string;
  onWithdraw: (id: string) => void;
  onDecideOffer: (id: string, decision: 'ACCEPT' | 'DECLINE') => void;
  onAttachPreAdmissionFile: (item: PreAdmissionDocument, event: ChangeEvent<HTMLInputElement>) => void;
  onSelectExistingDocument: (requirementId: string, documentId: string) => void;
}) {
  const pendingOffers = offers.filter((offer) => offer.status === 'SENT');
  const otherOffers = offers.filter((offer) => offer.status !== 'SENT');

  return (
    <div className="space-y-5">
      {pendingOffers.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardTitle title="Proposta aguardando sua resposta" hint="Leia com atenção antes de decidir." />
          <div className="space-y-3">
            {pendingOffers.map((offer) => <OfferCard key={offer.id} offer={offer} busy={busy} onDecide={onDecideOffer} />)}
          </div>
        </Card>
      )}

      {preAdmissions.length > 0 && (
        <Card>
          <CardTitle title="Admissão" hint="Documentos e exame para a sua contratação." />
          <div className="space-y-4">
            {preAdmissions.map((pre) => (
              <PreAdmissionCard
                key={pre.id}
                pre={pre}
                documents={documents}
                busy={busy}
                onAttachFile={onAttachPreAdmissionFile}
                onSelectExisting={onSelectExistingDocument}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle title="Minhas candidaturas" hint={applications.length > 0 ? `${applications.length} no total.` : undefined} />
        {applications.length === 0 ? (
          <EmptyState
            icon={<BriefcaseBusiness className="h-8 w-8" />}
            title="Nenhuma candidatura ainda"
            description="Assim que você se candidatar a uma vaga, o andamento aparece aqui."
            action={
              <Link href={vacanciesHref}>
                <Button size="sm">Explorar vagas abertas</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const badge = status(APPLICATION_STATUS, app.status);
              const vacancyHref = `/carreiras/vagas/${app.posting.slug}${app.posting.company?.slug ? `?empresa=${encodeURIComponent(app.posting.company.slug)}` : publicSuffix}`;
              return (
                <article key={app.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      {app.posting.company?.name && (
                        <p className="text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">{app.posting.company.name}</p>
                      )}
                      <h3 className="mt-0.5 font-semibold text-slate-900 dark:text-slate-50">{app.posting.title}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {app.posting.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {app.posting.city}
                          </span>
                        )}
                        {app.posting.workMode && <span>{app.posting.workMode}</span>}
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" /> Inscrição em {formatDate(app.appliedAt)}
                        </span>
                      </p>
                    </div>
                    <Pill label={badge.label} tone={badge.tone} />
                  </div>

                  {app.stage && (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                      Etapa atual: <span className="font-semibold">{app.stage}</span>
                    </p>
                  )}
                  {app.rejectionReason && (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">{app.rejectionReason}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={vacancyHref}>
                      <Button variant="secondary" size="sm">Ver vaga</Button>
                    </Link>
                    {app.status === 'ACTIVE' && (
                      <Button variant="danger" size="sm" disabled={busy} onClick={() => onWithdraw(app.id)}>
                        <XCircle className="h-3.5 w-3.5" /> Desistir
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      {otherOffers.length > 0 && (
        <Card>
          <CardTitle title="Histórico de propostas" />
          <div className="space-y-3">
            {otherOffers.map((offer) => <OfferCard key={offer.id} offer={offer} busy={busy} onDecide={onDecideOffer} />)}
          </div>
        </Card>
      )}
    </div>
  );
}

function OfferCard({ offer, busy, onDecide }: { offer: Offer; busy: boolean; onDecide: (id: string, decision: 'ACCEPT' | 'DECLINE') => void }) {
  const badge = status(OFFER_STATUS, offer.status);
  return (
    <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-50">{offer.application.posting.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {[offer.application.posting.city, offer.application.posting.workMode].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Pill label={badge.label} tone={badge.tone} />
      </div>

      <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Remuneração</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1.5 text-base font-bold text-slate-900 dark:text-slate-50">
            <HandCoins className="h-4 w-4 text-emerald-600" /> {formatMoney(offer.salaryAmountCents, offer.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Início previsto</dt>
          <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{formatDate(offer.startDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Responder até</dt>
          <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{formatDate(offer.expiresAt)}</dd>
        </div>
      </dl>

      {offer.status === 'SENT' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="success" size="sm" disabled={busy} onClick={() => onDecide(offer.id, 'ACCEPT')}>Aceitar proposta</Button>
          <Button variant="danger" size="sm" disabled={busy} onClick={() => onDecide(offer.id, 'DECLINE')}>Recusar</Button>
        </div>
      )}
    </article>
  );
}

function PreAdmissionCard({
  pre,
  documents,
  busy,
  onAttachFile,
  onSelectExisting,
}: {
  pre: PreAdmission;
  documents: CandidateDocument[];
  busy: boolean;
  onAttachFile: (item: PreAdmissionDocument, event: ChangeEvent<HTMLInputElement>) => void;
  onSelectExisting: (requirementId: string, documentId: string) => void;
}) {
  const badge = status(PRE_ADMISSION_STATUS, pre.status);
  const approved = pre.documents.filter((doc) => doc.status === 'APPROVED' || doc.status === 'WAIVED').length;
  const exams = pre.occupationalExamRequests ?? [];

  return (
    <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-50">{pre.application.posting.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Data prevista de admissão: {formatDate(pre.admissionTargetDate)}</p>
        </div>
        <Pill label={badge.label} tone={badge.tone} />
      </div>

      {pre.documents.length > 0 && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((approved / pre.documents.length) * 100)}%` }} />
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {approved}/{pre.documents.length} aprovados
            </span>
          </div>

          <ul className="mt-4 space-y-2.5">
            {pre.documents.map((item) => {
              const docBadge = status(DOCUMENT_STATUS, item.status);
              const canSend = ['PENDING', 'REJECTED', 'SUBMITTED'].includes(item.status);
              return (
                <li key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{item.title}</span>
                    {item.required && <span className="text-xs font-semibold text-rose-500">obrigatório</span>}
                    <Pill label={docBadge.label} tone={docBadge.tone} className="ml-auto" />
                  </div>
                  {item.candidateDocument && (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Arquivo enviado: {item.candidateDocument.fileName}</p>
                  )}
                  {item.reviewNote && (
                    <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{item.reviewNote}</p>
                  )}
                  {canSend && (
                    <div className="mt-2.5 space-y-2">
                      <label
                        className={`flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300 ${
                          busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <FileUp className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {item.status === 'REJECTED' ? 'Reenviar arquivo' : 'Enviar arquivo'} — PDF, JPG ou PNG, até 8 MB
                        </span>
                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={busy} onChange={(event) => onAttachFile(item, event)} />
                      </label>
                      {documents.length > 0 && (
                        <select
                          defaultValue={item.candidateDocumentId ?? ''}
                          disabled={busy}
                          onChange={(event) => onSelectExisting(item.id, event.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="">Ou usar um arquivo que você já enviou…</option>
                          {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.fileName}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {exams.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <HeartPulse className="h-4 w-4 text-sky-500" /> Exame admissional
          </p>
          <div className="space-y-2">
            {exams.map((exam) => (
              <div key={exam.id} className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{text(EXAM_TYPE, exam.examType)}</span>
                  <Pill label={metaOf(ASO_STATUS, exam.status).label} />
                  {exam.asoRecord?.result && <Pill label={metaOf(ASO_RESULT, exam.asoRecord.result).label} tone="positive" />}
                </div>
                {exam.appointment && (
                  <p className="mt-1.5 text-slate-600 dark:text-slate-300">
                    {formatDateTime(exam.appointment.scheduledAt)}
                    {exam.appointment.location ? ` · ${exam.appointment.location}` : ''}
                    {exam.appointment.providerName ? ` · ${exam.appointment.providerName}` : ''}
                  </p>
                )}
                {exam.appointment?.instructions && <p className="mt-1 text-slate-500 dark:text-slate-400">{exam.appointment.instructions}</p>}
                {exam.asoRecord && (
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Exame em {formatDate(exam.asoRecord.examDate)}
                    {exam.asoRecord.validUntil ? ` · validade até ${formatDate(exam.asoRecord.validUntil)}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
