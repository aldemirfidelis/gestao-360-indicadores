import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Vagas e oportunidades | Gestão 360',
  description: 'Encontre vagas abertas nas empresas que recrutam pelo Gestão 360 e acompanhe suas candidaturas em um perfil único.',
};

export default function CareersLayout({ children }: { children: ReactNode }) {
  return children;
}
