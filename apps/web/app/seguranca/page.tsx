import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';
export const metadata: Metadata = publicMetadata({
  title: 'Acesso, permissões e rastreabilidade | Gestão 360',
  description:
    'Conheça os controles de acesso por empresa, perfis e áreas, os históricos e as responsabilidades na utilização do Gestão 360.',
  path: '/seguranca',
});
const items = [
  [
    'Dados por empresa',
    'O acesso aos registros operacionais considera a empresa da sessão. As informações da sua organização ficam no ambiente autenticado.',
    'Estrutura',
  ],
  [
    'Perfis e permissões',
    'A visibilidade e as ações disponíveis dependem do perfil, do módulo e do escopo de área configurado para cada usuário.',
    'Acesso',
  ],
  [
    'Histórico e responsabilidade',
    'Os módulos mantêm registros de alterações, responsáveis e evidências conforme seus fluxos, apoiando a recuperação do contexto das decisões.',
    'Rastreabilidade',
  ],
  [
    'Configuração com a sua equipe',
    'A implantação define usuários, responsabilidades e módulos. Recursos opcionais e provedores são avaliados conforme o escopo e as necessidades da empresa.',
    'Governança',
  ],
];
export default function SegurancaPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Segurança',
            description: metadata.description as string,
            path: '/seguranca',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Segurança', path: '/seguranca' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Governança e acesso"
        title="Cada pessoa com o acesso adequado ao seu trabalho."
        description="Organize empresas, perfis e responsabilidades para que a gestão respeite o contexto e o escopo de cada equipe."
      />
      <section className="public-section">
        <div className="public-container public-catalog-grid" style={{ marginTop: 0 }}>
          {items.map(([title, text, label]) => (
            <article key={title}>
              <span className="public-eyebrow">{label}</span>
              <h2 style={{ fontSize: 26 }}>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
