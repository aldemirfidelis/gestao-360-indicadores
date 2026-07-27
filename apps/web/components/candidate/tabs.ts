import { BriefcaseBusiness, FileText, Home, ShieldCheck, UserRound } from 'lucide-react';

export type PortalTab = 'inicio' | 'candidaturas' | 'perfil' | 'documentos' | 'privacidade';

export const PORTAL_TABS: Array<{ id: PortalTab; label: string; icon: typeof Home }> = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'candidaturas', label: 'Candidaturas', icon: BriefcaseBusiness },
  { id: 'perfil', label: 'Meu perfil', icon: UserRound },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'privacidade', label: 'Privacidade', icon: ShieldCheck },
];
