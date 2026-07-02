'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { HelpBotChat } from './help-bot-chat';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HelpBotFloatingButton() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showBalloon, setShowBalloon] = useState(true);

  // Fecha o chat ao mudar de rota (opcional) ou apenas atualiza contexto
  useEffect(() => {
    // Mantém aberto se o usuário estiver usando, mas esconde balão inicial
    setShowBalloon(false);
  }, [pathname]);

  // Esconder balão de saudação automaticamente após 7 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBalloon(false);
    }, 7000);
    return () => clearTimeout(timer);
  }, []);

  // Mapeamento de rota -> módulo atual
  const getRouteContext = (path: string) => {
    const p = path || '';
    if (p.startsWith('/tarefas')) {
      return { route: p, module: 'Tarefas', pageTitle: 'Central de Trabalho da Equipe' };
    }
    if (p.startsWith('/indicators') || p.startsWith('/indicadores')) {
      return { route: p, module: 'Indicadores', pageTitle: 'Gestão de Indicadores e Metas' };
    }
    if (p.startsWith('/documents') || p.startsWith('/documentos')) {
      return { route: p, module: 'Documentos', pageTitle: 'Gestão Documental (GED)' };
    }
    if (p.startsWith('/forms') || p.startsWith('/formularios')) {
      return { route: p, module: 'Formulários', pageTitle: 'Formulários e Checklists' };
    }
    if (p.startsWith('/nonconformities') || p.startsWith('/nc')) {
      return { route: p, module: 'Não Conformidades', pageTitle: 'Gestão de Desvios e NCs' };
    }
    if (p.startsWith('/audits') || p.startsWith('/auditorias')) {
      return { route: p, module: 'Auditorias', pageTitle: 'Auditorias de Qualidade e Compliance' };
    }
    if (p.startsWith('/actions') || p.startsWith('/planos')) {
      return { route: p, module: 'Planos de Ação', pageTitle: 'Acompanhamento de Ações' };
    }
    if (p.startsWith('/risks') || p.startsWith('/riscos')) {
      return { route: p, module: 'Riscos', pageTitle: 'Matriz e Registro de Riscos' };
    }
    if (p.startsWith('/meetings') || p.startsWith('/reunioes')) {
      return { route: p, module: 'Reuniões', pageTitle: 'Atas, Pautas e Decisões' };
    }
    if (p.startsWith('/seguranca-alimentos')) {
      return { route: p, module: 'Segurança de Alimentos', pageTitle: 'Segurança Alimentar' };
    }
    if (p.startsWith('/seguranca-patrimonial')) {
      return { route: p, module: 'Segurança Patrimonial', pageTitle: 'Controles Patrimoniais e Portaria' };
    }
    if (p.startsWith('/comunicacao')) {
      return { route: p, module: 'Comunicação Interna', pageTitle: 'Mensagens, Mural e Chat' };
    }
    return { route: p, module: 'Geral', pageTitle: 'Painel Gestão 360' };
  };

  const context = getRouteContext(pathname ?? '');

  return (
    <>
      {/* Estilos específicos de animação do Robô */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes g360Float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes g360Shadow {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(0.85); opacity: 0.15; }
        }
        .animate-robot-float {
          animation: g360Float 3s ease-in-out infinite;
        }
        .animate-robot-shadow {
          animation: g360Shadow 3s ease-in-out infinite;
          transform-origin: center;
        }
      `}} />

      <div className="fixed bottom-4 right-4 z-[999] flex flex-col items-end gap-3 pointer-events-none select-none">

        {/* Painel do Chat Aberto */}
        {isOpen && (
          <div className="pointer-events-auto animate-in fade-in-50 slide-in-from-bottom-5 duration-300">
            <HelpBotChat
              currentContext={context}
              onMinimize={() => setIsOpen(false)}
              onClose={() => setIsOpen(false)}
            />
          </div>
        )}

        {/* Botão do Robozinho Flutuante (Visível se fechado) */}
        {!isOpen && (
          <div className="relative flex flex-col items-center pointer-events-auto shrink-0">

            {/* Balão de Saudação */}
            {showBalloon && (
              <div className="absolute bottom-16 right-0 bg-card border border-border/80 text-foreground px-3 py-1.5 rounded-lg shadow-xl text-[10px] font-medium whitespace-nowrap flex items-center gap-1.5 animate-bounce z-10">
                <div className="flex items-center gap-1 text-blue-600">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  <span>Olá! Precisa de ajuda com o Gestão 360?</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBalloon(false);
                  }}
                  className="p-0.5 hover:bg-muted rounded text-muted-foreground transition ml-1"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
                {/* Flecha do Balão */}
                <div className="absolute -bottom-1 right-6 h-2 w-2 bg-card border-r border-b border-border/80 rotate-45" />
              </div>
            )}

            {/* O Robô G360 (SVG interativo com float) */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setShowBalloon(false);
              }}
              className="group relative flex flex-col items-center justify-center w-14 h-14 rounded-full bg-white dark:bg-card border-2 border-blue-500/80 hover:border-cyan-500 shadow-lg hover:shadow-cyan-500/20 active:scale-95 transition-all duration-300 cursor-pointer overflow-visible animate-robot-float"
            >
              {/* Brilho de fundo no Hover */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition duration-300" />

              <svg width="42" height="42" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-300 group-hover:rotate-3 group-hover:scale-105">
                {/* Ombros/Base */}
                <path d="M14 36C14 33.5 17.5 31.5 24 31.5C30.5 31.5 34 33.5 34 36V39H14V36Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round"/>

                {/* Pescoço */}
                <rect x="21" y="27" width="6" height="5" rx="1.5" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1.5"/>

                {/* Cabeça Arredondada (Efeito 3D/Cartoon) */}
                <rect x="10" y="11" width="28" height="17" rx="7" stroke="#3B82F6" strokeWidth="2.5" strokeLinejoin="round" className="fill-white dark:fill-slate-800 filter drop-shadow-sm"/>

                {/* Orelhas */}
                <rect x="7" y="16" width="3" height="6" rx="1.5" fill="#3B82F6"/>
                <rect x="38" y="16" width="3" height="6" rx="1.5" fill="#3B82F6"/>

                {/* Painel dos Olhos */}
                <rect x="14" y="14" width="20" height="9" rx="3.5" fill="#0F172A"/>

                {/* Olhos Ciano Brilhantes */}
                <circle cx="19" cy="18.5" r="2" fill="#22D3EE" className="animate-pulse"/>
                <circle cx="29" cy="18.5" r="2" fill="#22D3EE" className="animate-pulse"/>

                {/* Sorriso Amigável */}
                <path d="M21 24.2C22 24.8 26 24.8 27 24.2" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/>

                {/* Antena com LED que pisca */}
                <line x1="24" y1="11" x2="24" y2="6" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="24" cy="5" r="2" fill="#22D3EE" className="animate-ping" style={{ animationDuration: '2s' }}/>
                <circle cx="24" cy="5" r="1.8" fill="#06B6D4"/>
              </svg>
            </button>

            {/* Sombra Dinâmica */}
            <div className="w-10 h-1 bg-black/15 rounded-full filter blur-[1px] mt-1.5 animate-robot-shadow" />
          </div>
        )}
      </div>
    </>
  );
}
