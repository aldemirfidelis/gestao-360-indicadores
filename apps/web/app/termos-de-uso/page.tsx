import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/marketing/content-blocks';
import { JsonLd } from '@/components/marketing/json-ld';
import { LegalDocument, type LegalSection } from '@/components/marketing/legal-document';
import { PublicShell } from '@/components/marketing/public-shell';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Termos de uso',
  description: 'Termos de uso do site, da demonstração e do portal autenticado Gestão 360.',
  path: '/termos-de-uso',
});

const sections: LegalSection[] = [
  {
    title: '1. Aceitação e escopo',
    paragraphs: [
      'Estes Termos regulam o uso das páginas públicas, formulários, ambiente de demonstração e áreas autenticadas do Gestão 360. Ao acessar ou usar esses recursos, você declara que leu e concorda com estas regras.',
      'Condições comerciais, níveis de serviço, módulos contratados, valores e responsabilidades específicas constam da proposta ou do contrato celebrado com a empresa cliente. Em caso de conflito, o instrumento contratual prevalece para a relação contratada.',
    ],
  },
  {
    title: '2. Cadastro, acesso e segurança da conta',
    items: [
      'O acesso ao portal operacional depende de credenciais válidas e das permissões concedidas pela organização responsável pelo ambiente.',
      'Cada usuário deve manter suas credenciais em sigilo, usar dados verdadeiros e comunicar imediatamente qualquer suspeita de acesso indevido.',
      'Contas são pessoais. Não é permitido compartilhar senhas, contornar controles de acesso ou utilizar a identidade de outra pessoa.',
    ],
  },
  {
    title: '3. Uso permitido',
    paragraphs: ['O Gestão 360 deve ser usado para finalidades profissionais legítimas, de acordo com a lei, o contrato e as políticas da organização usuária.'],
    items: [
      'É proibido inserir código malicioso, tentar explorar vulnerabilidades ou prejudicar a disponibilidade do serviço.',
      'É proibido acessar, copiar ou divulgar dados sem autorização, inclusive dados de outros usuários ou empresas.',
      'É proibido usar automações abusivas, realizar engenharia reversa indevida ou remover avisos de propriedade intelectual.',
    ],
  },
  {
    title: '4. Conteúdo e responsabilidade da organização cliente',
    paragraphs: [
      'A organização cliente define usuários, permissões, processos e dados inseridos em seu ambiente. Ela é responsável pela licitude, qualidade e autorização para uso desse conteúdo, bem como pelas decisões tomadas a partir das informações registradas.',
      'Recursos analíticos ou assistidos apoiam a gestão, mas não substituem avaliação profissional, controles internos, decisão humana ou obrigação regulatória aplicável ao negócio.',
    ],
  },
  {
    title: '5. Demonstração e trial',
    paragraphs: [
      'A demonstração utiliza dados simulados e pode diferir de um ambiente contratado. A solicitação de trial de 30 dias está sujeita à validação dos dados, disponibilidade de onboarding e definição dos módulos de avaliação.',
      'Solicitar demonstração ou trial não constitui contratação, não gera cobrança automática e não garante a liberação até a confirmação da equipe do Gestão 360.',
    ],
  },
  {
    title: '6. Propriedade intelectual',
    paragraphs: [
      'A plataforma, sua identidade visual, estrutura, documentação e código são protegidos pela legislação aplicável. O acesso concede apenas uma licença limitada, revogável, não exclusiva e vinculada às finalidades autorizadas; não transfere propriedade.',
      'Conteúdos inseridos pela organização cliente permanecem sob responsabilidade e titularidade de seus respectivos proprietários.',
    ],
  },
  {
    title: '7. Disponibilidade, integrações e alterações',
    paragraphs: [
      'A plataforma pode receber manutenção, correções e melhorias. Interrupções podem ocorrer por manutenção, falhas externas, eventos de segurança ou causas fora do controle razoável do serviço.',
      'Integrações de terceiros estão sujeitas também às regras e à disponibilidade de seus fornecedores. Funcionalidades podem evoluir, desde que preservadas as obrigações contratuais aplicáveis.',
    ],
  },
  {
    title: '8. Privacidade e proteção de dados',
    paragraphs: [
      <>O tratamento de dados pessoais é descrito na <Link href="/politica-de-privacidade" className="font-semibold text-emerald-700 hover:underline">Política de Privacidade</Link> e na página de <Link href="/lgpd" className="font-semibold text-emerald-700 hover:underline">LGPD e direitos dos titulares</Link>.</>,
    ],
  },
  {
    title: '9. Suspensão e encerramento',
    paragraphs: [
      'O acesso pode ser suspenso para proteção da segurança, prevenção de abuso, cumprimento legal, inadimplência ou violação destes Termos e do contrato. Sempre que razoável, a parte responsável será comunicada.',
    ],
  },
  {
    title: '10. Limites e legislação aplicável',
    paragraphs: [
      'Cada parte responde pelos danos diretos que causar nos limites da legislação e do contrato aplicável. Nenhuma disposição destes Termos exclui direitos ou responsabilidades que não possam ser legalmente limitados.',
      'Aplica-se a legislação brasileira. O foro e os mecanismos de solução de controvérsia da relação contratual são os previstos no respectivo instrumento comercial.',
    ],
  },
  {
    title: '11. Atualizações e contato',
    paragraphs: [
      <>Estes Termos podem ser atualizados para refletir mudanças legais ou do serviço. A data e a versão serão informadas nesta página. Para dúvidas, use o <Link href="/suporte#formulario" className="font-semibold text-emerald-700 hover:underline">formulário de suporte</Link>.</>,
    ],
  },
];

export default function TermsPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Termos de uso', description: metadata.description as string, path: '/termos-de-uso' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Termos de uso', path: '/termos-de-uso' }])]} />
      <PageHero eyebrow="Termos" title="Termos de uso do Gestão 360." description="Regras para uso responsável do site, da demonstração, do trial e das áreas autenticadas da plataforma." />
      <LegalDocument version="1.0" updatedAt="28 de junho de 2026" sections={sections} />
    </PublicShell>
  );
}
