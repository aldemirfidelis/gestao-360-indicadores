import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { WHATSAPP_URL, type FaqItem, type PublicPage } from '@/lib/public-site';

export function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="border-b border-slate-200 bg-slate-950 py-16 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">{description}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/contato" className="inline-flex h-11 items-center justify-center gap-2 bg-emerald-400 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-300">
            Solicitar demonstracao <ArrowRight className="h-4 w-4" />
          </Link>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center border border-white/30 px-5 text-sm font-semibold text-white hover:bg-white hover:text-slate-950">
            Falar pelo WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

export function ListingGrid({ pages }: { pages: PublicPage[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {pages.map((page) => (
        <Link key={page.path} href={page.path} className="group border border-slate-200 bg-white p-5 hover:border-slate-950">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{page.eyebrow}</div>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">{page.title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{page.summary}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
            Ler mais <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function PublicPageBody({ page, related }: { page: PublicPage; related?: PublicPage[] }) {
  return (
    <>
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr,1.15fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Problema resolvido</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Por que isso importa</h2>
            <p className="mt-5 text-base leading-7 text-slate-600">{page.problem}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {page.benefits.map((benefit) => (
              <div key={benefit} className="flex gap-3 border border-slate-200 bg-slate-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-6 text-slate-700">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Funcionalidades relacionadas</h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {page.features.map((feature) => <span key={feature} className="border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">{feature}</span>)}
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Exemplos de uso</h2>
            <ul className="mt-6 grid gap-3">
              {page.useCases.map((useCase) => <li key={useCase} className="border border-slate-200 bg-white p-4 text-sm text-slate-700">{useCase}</li>)}
            </ul>
          </div>
        </div>
      </section>
      <FaqBlock faq={page.faq} />
      {related && related.length > 0 && (
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Tambem pode ajudar</h2>
            <div className="mt-8">
              <ListingGrid pages={related} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export function FaqBlock({ faq }: { faq: FaqItem[] }) {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Perguntas frequentes</h2>
        <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
          {faq.map((item) => (
            <div key={item.question} className="py-5">
              <h3 className="font-semibold text-slate-950">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
