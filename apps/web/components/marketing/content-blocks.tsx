import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ArticlePage, FaqItem, PublicPage } from '@/lib/public-site';
import { DemoLink } from './demo-link';

export function PageHero({
  eyebrow,
  title,
  description,
  showDemoCta = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  showDemoCta?: boolean;
}) {
  return (
    <section className="public-page-hero">
      <div className="public-container">
        <span className="public-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {showDemoCta && (
          <div className="public-actions">
            <DemoLink source="public_page_hero" className="public-button public-button-cyan">
              Conhecer a demonstração <ArrowRight size={16} aria-hidden="true" />
            </DemoLink>
            <Link
              href="/teste-gratis"
              data-track="trial_click"
              data-track-label="public_page_hero"
              className="public-button public-button-outline"
            >
              Experimente o Gestão 360
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export function ListingGrid({ pages }: { pages: PublicPage[] }) {
  return (
    <div className="public-listing">
      {pages.map((page) => (
        <Link key={page.path} href={page.path}>
          <span className="public-eyebrow">{page.eyebrow}</span>
          <h2>{page.title}</h2>
          <p>{page.summary}</p>
          <span className="public-text-link">
            Explorar solução <ArrowRight size={15} aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function ArticleListing({ articles }: { articles: ArticlePage[] }) {
  return (
    <div className="public-listing">
      {articles.map((article) => (
        <Link key={article.path} href={article.path}>
          <span className="public-eyebrow">{article.category}</span>
          <h2>{article.title}</h2>
          <p>{article.description}</p>
          <div className="public-article-meta">
            {article.readingTime} · Revisado em{' '}
            <time dateTime={article.updatedAt}>
              {new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(article.updatedAt))}
            </time>
          </div>
          <span className="public-text-link">
            Ler artigo <ArrowRight size={15} aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function PublicPageBody({ page, related }: { page: PublicPage; related?: PublicPage[] }) {
  return (
    <>
      <section className="public-section">
        <div className="public-container public-body-grid">
          <div>
            <span className="public-eyebrow">O desafio da gestão</span>
            <h2>Por que isso importa</h2>
            <p>{page.problem}</p>
          </div>
          <div className="public-benefit-lines">
            {page.benefits.map((benefit) => (
              <div key={benefit}>
                <CheckCircle2 size={18} aria-hidden="true" />
                <p>{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="public-section public-detail-band">
        <div className="public-container public-body-grid">
          <div>
            <h2>Recursos para o trabalho</h2>
            <div className="public-tags">
              {page.features.map((feature) => (
                <span key={feature}>{feature}</span>
              ))}
            </div>
          </div>
          <div>
            <h2>Onde usar</h2>
            <ul className="public-use-cases">
              {page.useCases.map((useCase) => (
                <li key={useCase}>{useCase}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <FaqBlock faq={page.faq} />
      {related && related.length > 0 && (
        <section className="public-section">
          <div className="public-container">
            <div className="public-section-heading">
              <span className="public-eyebrow">Continue explorando</span>
              <h2>Conexões que fazem sentido</h2>
            </div>
            <ListingGrid pages={related} />
          </div>
        </section>
      )}
    </>
  );
}

export function FaqBlock({ faq }: { faq: FaqItem[] }) {
  return (
    <section className="public-faq">
      <div className="public-container public-faq-grid">
        <div className="public-faq-intro">
          <span className="public-eyebrow">Respostas para começar</span>
          <h2>Perguntas frequentes</h2>
          <p>
            Entenda o acesso, a avaliação e como a plataforma pode participar da gestão da sua
            empresa.
          </p>
          <Link href="/contato" className="public-text-link">
            Converse com a equipe <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div>
          {faq.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
