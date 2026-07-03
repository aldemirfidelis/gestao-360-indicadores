'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Minimize2, Send, Sparkles, BookOpen, FileText, Loader2, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// Tipagem de Mensagem
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    title: string;
    slug?: string;
    id?: string;
    type: 'manual' | 'company_document';
  }>;
}

interface HelpBotChatProps {
  onClose: () => void;
  onMinimize: () => void;
  currentContext: {
    route: string;
    module: string;
    pageTitle?: string;
  };
}

const QUICK_SUGGESTIONS = [
  'Como criar uma tarefa?',
  'Como cadastrar um indicador?',
  'Como preencher o Ishikawa?',
  'Como preencher o 5W2H?',
  'Como abrir uma não conformidade?',
  'Como gerar QR Code de formulário?',
  'Como criar um plano de ação?',
  'Como tratar um desvio?',
  'Como acompanhar tarefas atrasadas?'
];

export function HelpBotChat({ onClose, onMinimize, currentContext }: HelpBotChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Eu sou o Assistente do Gestão 360. Como posso ajudar você hoje?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [viewingSource, setViewingSource] = useState<any | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceData, setSourceData] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Função para enviar pergunta
  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessageText = textToSend.trim();
    setInput('');

    // Adicionar mensagem do usuário no estado local
    const userMsgId = `user_${Date.now()}`;
    const userMsg: Message = { id: userMsgId, role: 'user', content: userMessageText };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Monta histórico no formato aceito pelo backend
      const history = messages
        .filter(m => m.id !== 'welcome') // Opcional: ignorar mensagem de boas-vindas
        .map(m => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content
        }));

      // Chama endpoint da API
      const res = await api<{ answer: string; sources: any[]; conversationId: string }>('/assistant/help', {
        method: 'POST',
        json: {
          message: userMessageText,
          module: currentContext.module,
          route: currentContext.route,
          conversationId,
          history
        }
      });

      // Salva ID da conversa para turnos subsequentes
      if (res.conversationId) {
        setConversationId(res.conversationId);
      }

      // Adiciona resposta do bot
      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        sources: res.sources
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Erro ao chamar o assistente:', err);
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: 'Não consegui responder agora. Tente novamente em alguns instantes.'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Carregar conteúdo detalhado da fonte consultada
  const handleOpenSource = async (source: any) => {
    setViewingSource(source);
    setSourceLoading(true);
    setSourceData(null);

    try {
      if (source.type === 'manual' && source.slug) {
        const data = await api<any>(`/help/articles/${source.slug}`);
        setSourceData(data);
      } else if (source.type === 'company_document' && source.id) {
        const data = await api<any>(`/documents/${source.id}`);
        setSourceData(data);
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes da fonte:', err);
      setSourceData({
        title: source.title,
        body: 'Não foi possível carregar o conteúdo desta fonte no momento.'
      });
    } finally {
      setSourceLoading(false);
    }
  };

  // Parser simplificado de Markdown
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Listas
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-foreground/90 leading-relaxed mt-0.5">
            {parseBold(trimmed.slice(2))}
          </li>
        );
      }

      // Títulos
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-xs font-bold text-foreground mt-2 mb-0.5">
            {parseBold(trimmed.slice(4))}
          </h4>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-foreground mt-3 mb-1">
            {parseBold(trimmed.slice(3))}
          </h3>
        );
      }

      // Parágrafo vazio
      if (trimmed === '') {
        return <div key={idx} className="h-1.5" />;
      }

      // Parágrafo padrão
      return (
        <p key={idx} className="text-xs text-foreground/90 leading-relaxed mb-1">
          {parseBold(line)}
        </p>
      );
    });
  };

  const parseBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="relative flex flex-col w-[380px] h-[550px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-blue-600/90 to-cyan-600/90 text-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/10 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-card shadow-sm animate-ping" />
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-card shadow-sm" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-wide">Assistente G360</h3>
            <p className="text-[10px] text-cyan-100/80">Online · Ajuda Inteligente</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMinimize}
            className="p-1 hover:bg-white/10 rounded-md transition text-white/90 hover:text-white"
            title="Minimizar"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-md transition text-white/90 hover:text-white"
            title="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Corpo principal do Chat */}
      <div className="flex-1 flex flex-col min-h-0 bg-background/50">
        {/* Lista de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm transition-all',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none ml-auto'
                  : 'bg-card border border-border/60 text-foreground rounded-tl-none mr-auto'
              )}
            >
              <div className="space-y-1">
                {msg.role === 'user' ? (
                  <p className="leading-relaxed">{msg.content}</p>
                ) : (
                  <div>{renderMarkdown(msg.content)}</div>
                )}
              </div>

              {/* Fontes Consultadas */}
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-border/40 text-[10px]">
                  <span className="block text-muted-foreground font-semibold mb-1">Fontes consultadas:</span>
                  <div className="flex flex-wrap gap-1">
                    {msg.sources.map((src, sidx) => (
                      <button
                        key={sidx}
                        type="button"
                        onClick={() => handleOpenSource(src)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-medium transition max-w-full truncate"
                      >
                        {src.type === 'manual' ? (
                          <BookOpen className="w-3 h-3 text-blue-500 shrink-0" />
                        ) : (
                          <FileText className="w-3 h-3 text-cyan-500 shrink-0" />
                        )}
                        <span className="truncate">{src.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Indicador de Digitação */}
          {loading && (
            <div className="flex flex-col max-w-[85%] rounded-2xl px-3 py-2 bg-card border border-border/60 text-foreground rounded-tl-none mr-auto shadow-sm">
              <div className="flex items-center gap-1.5 py-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Elemento âncora para scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões Rápidas (Exibe apenas se tiver apenas a mensagem de boas vindas) */}
        {messages.length === 1 && !loading && (
          <div className="px-4 py-2 border-t border-border/30 shrink-0">
            <span className="block text-[10px] text-muted-foreground font-medium mb-1.5">Perguntas frequentes:</span>
            <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto scrollbar-none">
              {QUICK_SUGGESTIONS.map((sug, sidx) => (
                <button
                  key={sidx}
                  type="button"
                  onClick={() => handleSend(sug)}
                  className="px-2 py-1 text-[10px] rounded-full border border-border hover:border-blue-500/50 hover:bg-blue-500/[0.04] text-muted-foreground hover:text-blue-600 transition text-left"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Campo de Input de Mensagem */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="p-3 border-t border-border/50 bg-card flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Digite sua dúvida sobre o Gestão 360..."
            className="flex-1 h-9 px-3 py-1.5 text-xs rounded-lg border border-border bg-background placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Visualizador de Fontes Incorporado (Nested Drawer) */}
      {viewingSource && (
        <div className="absolute inset-0 z-50 bg-background flex flex-col transition-all duration-300 animate-in slide-in-from-right">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-muted/30 shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewingSource(null);
                setSourceData(null);
              }}
              className="p-1 hover:bg-muted rounded-md transition text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <span className="block text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Visualizando Documento</span>
              <h4 className="text-xs font-bold truncate text-foreground">{viewingSource.title}</h4>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto p-4 leading-relaxed text-xs">
            {sourceLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span>Carregando conteúdo...</span>
              </div>
            ) : sourceData ? (
              <div className="space-y-3">
                {sourceData.summary && (
                  <p className="text-[11px] text-muted-foreground border-l-2 border-blue-500 pl-2 italic">
                    {sourceData.summary}
                  </p>
                )}

                {/* Conteúdo principal */}
                <div className="whitespace-pre-wrap rounded-lg border border-border/50 bg-muted/10 p-3 text-xs leading-5 text-foreground">
                  {sourceData.body || sourceData.content || 'Este documento não possui corpo de texto cadastrado.'}
                </div>

                {sourceData.category && (
                  <div className="text-[10px] text-muted-foreground border-t border-border/30 pt-2">
                    Categoria: <span className="font-semibold">{sourceData.category.title}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-10">
                Não foi possível carregar a fonte de dados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
