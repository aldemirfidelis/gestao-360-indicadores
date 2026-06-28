import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/marketing/content-blocks';
import { JsonLd } from '@/components/marketing/json-ld';
import { LegalDocument, type LegalSection } from '@/components/marketing/legal-document';
import { PublicShell } from '@/components/marketing/public-shell';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'LGPD e direitos dos titulares',
  description: 'Conheça os direitos previstos na LGPD e como enviar uma solicitação de privacidade ao Gestão 360.',
  path: '/lgpd',
});

const sections: LegalSection[] = [
  {
    title: 'Seus direitos',
    paragraphs: ['Nos limites e condições da Lei Geral de Proteção de Dados, o titular pode solicitar:'],
    items: [
      'confirmação da existência de tratamento e acesso aos dados;',
      'correção de dados incompletos, inexatos ou desatualizados;',
      'anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;',
      'portabilidade, quando aplicável e conforme regulamentação;',
      'informações sobre compartilhamento e sobre a possibilidade de negar consentimento;',
      'eliminação dos dados tratados com consentimento e revogação do consentimento, quando essa for a base legal;',
      'revisão de decisões tomadas unicamente com base em tratamento automatizado que afetem seus interesses;',
      'oposição ao tratamento realizado em desconformidade com a LGPD e petição perante a Autoridade Nacional de Proteção de Dados.',
    ],
  },
  {
    title: 'Como fazer uma solicitação',
    paragraphs: [
      <>Acesse o <Link href="/suporte#formulario" className="font-semibold text-emerald-700 hover:underline">formulário de suporte</Link>, escolha “LGPD e privacidade”, identifique o direito que deseja exercer e explique sua solicitação. O envio será direcionado a suporte@gestao360.org.</>,
      'Para impedir acesso indevido, poderemos pedir dados adicionais de confirmação de identidade. Não envie senha, documento completo ou dados sensíveis no primeiro contato.',
    ],
  },
  {
    title: 'Quem responde',
    paragraphs: [
      'Quando a solicitação envolver dados de um ambiente corporativo, a organização cliente pode ser a controladora e responsável pela decisão. Nesse caso, o Gestão 360 poderá encaminhar ou apoiar o atendimento conforme as instruções contratuais.',
      'Quando o tratamento decorrer diretamente do site, do contato comercial ou da administração do serviço, a equipe responsável pelo Gestão 360 analisará a solicitação e informará o resultado ou as providências necessárias.',
    ],
  },
  {
    title: 'Prazo e resposta',
    paragraphs: [
      'A solicitação será respondida conforme os prazos e condições previstos na LGPD e na regulamentação aplicável. Pedidos complexos, de terceiros ou que envolvam obrigação de retenção podem exigir esclarecimentos adicionais ou resposta fundamentada.',
    ],
  },
  {
    title: 'Referências oficiais',
    items: [
      <a key="lei" href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:underline">Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais</a>,
      <a key="anpd" href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:underline">ANPD — Direitos dos titulares de dados</a>,
      <a key="privacidade" href="https://www.gov.br/anpd/pt-br/acesso-a-informacao/aviso-de-privacidade" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:underline">ANPD — Aviso de Privacidade</a>,
    ],
  },
];

export default function LgpdPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'LGPD e direitos dos titulares', description: metadata.description as string, path: '/lgpd' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'LGPD', path: '/lgpd' }])]} />
      <PageHero eyebrow="LGPD" title="Privacidade é um direito — e precisa de um canal claro." description="Veja quais direitos podem ser exercidos e como encaminhar uma solicitação relacionada aos seus dados pessoais." />
      <LegalDocument version="1.0" updatedAt="28 de junho de 2026" sections={sections} />
    </PublicShell>
  );
}
