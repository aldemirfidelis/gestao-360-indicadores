'use client';

import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import {
  Bold,
  Columns3,
  FileUp,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { DOCUMENT_REQUIRED_SECTIONS, emptyDoc, isDocNode, type DocNode } from '@g360/shared';
import { cn } from '@/lib/utils';
import { imageToDataUrl } from './files';
import './document-content.css';

export function documentExtensions(placeholder = 'Escreva o conteúdo do documento…') {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    TableKit.configure({ table: { resizable: false } }),
    Image.configure({ allowBase64: true, inline: false }),
    Placeholder.configure({ placeholder }),
  ];
}

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40',
        active && 'bg-primary/10 text-primary',
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, sigla, onImportDocx }: { editor: Editor; sigla?: string | null; onImportDocx?: (file: File) => Promise<string> }) {
  const imageInput = useRef<HTMLInputElement>(null);
  const docxInput = useRef<HTMLInputElement>(null);
  const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run();
  const sections = DOCUMENT_REQUIRED_SECTIONS[(sigla ?? '').toUpperCase()];
  const inTable = editor.isActive('table');

  const addImage = async (file: File | null) => {
    if (!file) return;
    try {
      const src = await imageToDataUrl(file);
      editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const addLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Endereço do link (https://...)', previous ?? 'https://');
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(href.trim())) {
      toast.error('Use um endereço começando com http:// ou https://');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
  };

  const insertSections = () => {
    if (!sections) return;
    const html = sections.map((title, index) => `<h1>${index + 1}. ${title}</h1><p></p>`).join('');
    editor.chain().focus().insertContent(html).run();
  };

  const importDocx = async (file: File | null) => {
    if (!file || !onImportDocx) return;
    if (!window.confirm('Substituir o conteúdo atual pelo texto do arquivo Word?')) return;
    try {
      const html = await onImportDocx(file);
      editor.commands.setContent(html);
      editor.commands.focus('start');
      toast.success('Conteúdo do Word importado. Confira a formatação e salve.');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card/95 px-2 py-1.5 backdrop-blur">
      <ToolButton label="Desfazer" disabled={!editor.can().undo()} onClick={() => run((c) => c.undo())}><Undo2 className="h-4 w-4" /></ToolButton>
      <ToolButton label="Refazer" disabled={!editor.can().redo()} onClick={() => run((c) => c.redo())}><Redo2 className="h-4 w-4" /></ToolButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton label="Título" active={editor.isActive('heading', { level: 1 })} onClick={() => run((c) => c.toggleHeading({ level: 1 }))}><Heading1 className="h-4 w-4" /></ToolButton>
      <ToolButton label="Subtítulo" active={editor.isActive('heading', { level: 2 })} onClick={() => run((c) => c.toggleHeading({ level: 2 }))}><Heading2 className="h-4 w-4" /></ToolButton>
      <ToolButton label="Título menor" active={editor.isActive('heading', { level: 3 })} onClick={() => run((c) => c.toggleHeading({ level: 3 }))}><Heading3 className="h-4 w-4" /></ToolButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton label="Negrito" active={editor.isActive('bold')} onClick={() => run((c) => c.toggleBold())}><Bold className="h-4 w-4" /></ToolButton>
      <ToolButton label="Itálico" active={editor.isActive('italic')} onClick={() => run((c) => c.toggleItalic())}><Italic className="h-4 w-4" /></ToolButton>
      <ToolButton label="Sublinhado" active={editor.isActive('underline')} onClick={() => run((c) => c.toggleUnderline())}><Underline className="h-4 w-4" /></ToolButton>
      <ToolButton label="Tachado" active={editor.isActive('strike')} onClick={() => run((c) => c.toggleStrike())}><Strikethrough className="h-4 w-4" /></ToolButton>
      <ToolButton label="Link" active={editor.isActive('link')} onClick={addLink}><Link2 className="h-4 w-4" /></ToolButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton label="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => run((c) => c.toggleBulletList())}><List className="h-4 w-4" /></ToolButton>
      <ToolButton label="Passo a passo numerado" active={editor.isActive('orderedList')} onClick={() => run((c) => c.toggleOrderedList())}><ListOrdered className="h-4 w-4" /></ToolButton>
      <ToolButton label="Citação / observação" active={editor.isActive('blockquote')} onClick={() => run((c) => c.toggleBlockquote())}><Quote className="h-4 w-4" /></ToolButton>
      <ToolButton label="Divisor" onClick={() => run((c) => c.setHorizontalRule())}><Minus className="h-4 w-4" /></ToolButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton label="Inserir tabela" onClick={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}><Table2 className="h-4 w-4" /></ToolButton>
      {inTable && (
        <>
          <ToolButton label="Adicionar linha" onClick={() => run((c) => c.addRowAfter())}><Rows3 className="h-4 w-4" /></ToolButton>
          <ToolButton label="Adicionar coluna" onClick={() => run((c) => c.addColumnAfter())}><Columns3 className="h-4 w-4" /></ToolButton>
          <ToolButton label="Remover linha" onClick={() => run((c) => c.deleteRow())}><Rows3 className="h-4 w-4 text-status-red" /></ToolButton>
          <ToolButton label="Remover coluna" onClick={() => run((c) => c.deleteColumn())}><Columns3 className="h-4 w-4 text-status-red" /></ToolButton>
          <ToolButton label="Excluir tabela" onClick={() => run((c) => c.deleteTable())}><Trash2 className="h-4 w-4 text-status-red" /></ToolButton>
        </>
      )}
      <ToolButton label="Inserir foto" onClick={() => imageInput.current?.click()}><ImagePlus className="h-4 w-4" /></ToolButton>
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          void addImage(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      {sections && (
        <>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolButton label="Inserir seções obrigatórias do tipo" onClick={insertSections}><ListChecks className="h-4 w-4" /></ToolButton>
        </>
      )}
      {onImportDocx && (
        <>
          <ToolButton label="Importar conteúdo de um arquivo Word" onClick={() => docxInput.current?.click()}><FileUp className="h-4 w-4" /></ToolButton>
          <input
            ref={docxInput}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              void importDocx(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}

/**
 * Editor visual do GED (gratuito, sem servidor de documentos). `value` é lido
 * só na montagem (JSON do documento ou HTML importado do Word); para trocar o
 * conteúdo por fora, remonte o componente com outra `key`.
 */
export function StructuredEditor({
  value,
  onChange,
  onReady,
  editable = true,
  sigla,
  onImportDocx,
  minHeight = '22rem',
  className,
}: {
  value: DocNode | string | null;
  onChange?: (doc: DocNode) => void;
  /** Chamado uma vez com o documento já normalizado pelo editor. */
  onReady?: (doc: DocNode) => void;
  editable?: boolean;
  sigla?: string | null;
  onImportDocx?: (file: File) => Promise<string>;
  minHeight?: string;
  className?: string;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const editor = useEditor({
    extensions: documentExtensions(),
    content: typeof value === 'string' ? value : isDocNode(value) ? value : emptyDoc(),
    editable,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'g360-doc px-5 py-4', spellcheck: 'true', lang: 'pt-BR' } },
    onCreate: ({ editor: current }) => onReadyRef.current?.(current.getJSON() as DocNode),
    onUpdate: ({ editor: current }) => onChangeRef.current?.(current.getJSON() as DocNode),
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return <div className="flex min-h-[18rem] items-center justify-center rounded-lg border text-sm text-muted-foreground">Carregando editor…</div>;
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card', className)} style={{ ['--g360-doc-min-height' as string]: minHeight }}>
      {editable && <Toolbar editor={editor} sigla={sigla} onImportDocx={onImportDocx} />}
      <EditorContent editor={editor} />
    </div>
  );
}

/** Leitura do documento estruturado (sem edição). */
export function StructuredViewer({ value, reader = false, className }: { value: DocNode | null; reader?: boolean; className?: string }) {
  const editor = useEditor({
    extensions: documentExtensions(''),
    content: isDocNode(value) ? value : emptyDoc(),
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: cn('g360-doc', reader && 'g360-doc-reader') } },
  });

  // Conteúdo novo (outra revisão, recarga): troca sem recriar o editor.
  const shown = useRef<DocNode | null>(isDocNode(value) ? value : null);
  useEffect(() => {
    if (!editor || !isDocNode(value) || shown.current === value) return;
    shown.current = value;
    editor.commands.setContent(value);
  }, [editor, value]);

  if (!editor) return <div className="py-10 text-center text-sm text-muted-foreground">Carregando documento…</div>;
  return <EditorContent editor={editor} className={className} style={{ ['--g360-doc-min-height' as string]: '0' }} />;
}
