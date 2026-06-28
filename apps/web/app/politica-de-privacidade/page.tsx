import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/marketing/content-blocks';
import { JsonLd } from '@/components/marketing/json-ld';
import { LegalDocument, type LegalSection } from '@/components/marketing/legal-document';
import { PublicShell } from '@/components/marketing/public-shell';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Política de privacidade',
  description: 'Política de privacidade do Gestão 360 sobre coleta, uso, proteção e direitos relacionados a dados pessoais.',
  path: '/politica-de-privacidade',
});

const sections: LegalSection[] = [
  {
    title: '1. Aplicação e papéis no tratamento',
    paragraphs: [
      'Esta Política explica como dados pessoais são tratados nas páginas públicas, nos formulários, na demonstração e no portal Gestão 360.',
      'Nos contatos públicos e na gestão de acesso ao serviço, o provedor do Gestão 360 trata os dados necessários ao atendimento e à prestação do serviço. Nos ambientes corporativos contratados, a organização cliente normalmente decide as finalidades e atua como controladora; o Gestão 360 trata os dados em seu nome, como operador, conforme o contrato e as instruções recebidas.',
    ],
  },
  {
    title: '2. Dados que podem ser coletados',
    items: [
      'Dados informados em formulários: nome, empresa, cargo, e-mail, telefone, assunto e mensagem.',
      'Dados de conta e uso: identificação do usuário, organização, permissões, registros de autenticação, ações realizadas e conteúdo corporativo autorizado.',
      'Dados técnicos: endereço IP, data e hora, navegador, dispositivo, páginas acessadas, registros de erro e eventos de segurança.',
      'Preferências armazenadas no navegador e métricas de navegação, quando os respectivos recursos estiverem habilitados.',
    ],
  },
  {
    title: '3. Finalidades e bases legais',
    items: [
      'Responder a solicitações de suporte, contato, demonstração e trial e realizar procedimentos relacionados a uma possível contratação.',
      'Autenticar usuários, fornecer funcionalidades, cumprir o contrato e administrar permissões e ambientes.',
      'Proteger contas, prevenir fraude, investigar incidentes e manter trilhas de auditoria com base em segurança e interesse legítimo.',
      'Cumprir obrigações legais ou regulatórias e exercer direitos em processos administrativos, arbitrais ou judiciais.',
      'Enviar comunicações autorizadas ou usar tecnologias que exijam consentimento, quando essa for a base aplicável e houver possibilidade de revogação.',
    ],
  },
  {
    title: '4. Compartilhamento',
    paragraphs: [
      'Dados podem ser compartilhados, no limite necessário, com provedores de infraestrutura, hospedagem, e-mail, monitoramento, suporte, segurança e integrações contratadas; com a organização responsável pelo ambiente; ou com autoridades quando houver obrigação legal.',
      'Não comercializamos dados pessoais. Prestadores devem tratar os dados para as finalidades contratadas e adotar medidas de proteção compatíveis.',
    ],
  },
  {
    title: '5. Cookies, armazenamento local e analytics',
    paragraphs: [
      'Cookies e armazenamento local podem ser usados para autenticação, segurança, preferências e funcionamento da interface. Ferramentas de analytics só são carregadas quando configuradas e devem evitar o envio desnecessário de dados pessoais.',
      'Configurações do navegador podem bloquear ou remover cookies, mas isso pode impedir o funcionamento de recursos essenciais, especialmente autenticação.',
    ],
  },
  {
    title: '6. Transferências e armazenamento',
    paragraphs: [
      'Alguns fornecedores podem processar dados em outras localidades. Quando houver transferência internacional, serão adotados mecanismos admitidos pela LGPD e medidas contratuais e técnicas apropriadas ao risco.',
    ],
  },
  {
    title: '7. Retenção e descarte',
    paragraphs: [
      'Os dados são mantidos pelo tempo necessário para atender às finalidades informadas, executar contratos, preservar segurança e auditoria, cumprir obrigações legais e exercer direitos. Depois disso, são eliminados ou anonimizados, salvo quando a conservação for autorizada ou exigida por lei.',
    ],
  },
  {
    title: '8. Segurança',
    paragraphs: [
      'São adotadas medidas administrativas e técnicas proporcionais ao contexto, incluindo autenticação, controle de acesso, segregação por organização, registros de auditoria, criptografia de credenciais sensíveis e monitoramento. Nenhum sistema é totalmente imune; incidentes relevantes serão tratados e comunicados conforme a legislação aplicável.',
    ],
  },
  {
    title: '9. Direitos dos titulares',
    paragraphs: [
      <>Você pode solicitar os direitos previstos na LGPD, conforme detalhado em <Link href="/lgpd" className="font-semibold text-emerald-700 hover:underline">LGPD e direitos dos titulares</Link>. Para iniciar uma solicitação, use o <Link href="/suporte#formulario" className="font-semibold text-emerald-700 hover:underline">formulário de suporte</Link> e selecione “LGPD e privacidade”. Poderemos pedir informações adicionais para confirmar sua identidade e proteger os dados.</>,
    ],
  },
  {
    title: '10. Crianças e adolescentes',
    paragraphs: [
      'A plataforma é voltada ao uso empresarial e não é direcionada intencionalmente a crianças. Caso uma organização precise tratar dados de crianças ou adolescentes em seu ambiente, deverá observar as regras da LGPD, o melhor interesse do titular e as bases legais aplicáveis.',
    ],
  },
  {
    title: '11. Atualizações e contato',
    paragraphs: [
      'Esta Política pode ser atualizada por mudanças legais, técnicas ou operacionais. A versão e a data mais recentes serão mantidas nesta página.',
      <>Dúvidas ou solicitações de privacidade devem ser encaminhadas pelo <Link href="/suporte#formulario" className="font-semibold text-emerald-700 hover:underline">canal de suporte</Link>, selecionando “LGPD e privacidade”.</>,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Política de privacidade', description: metadata.description as string, path: '/politica-de-privacidade' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Política de privacidade', path: '/politica-de-privacidade' }])]} />
      <PageHero eyebrow="Privacidade" title="Política de Privacidade do Gestão 360." description="Como coletamos, usamos, compartilhamos, protegemos e eliminamos dados pessoais no site e na plataforma." />
      <LegalDocument version="1.0" updatedAt="28 de junho de 2026" sections={sections} />
    </PublicShell>
  );
}
