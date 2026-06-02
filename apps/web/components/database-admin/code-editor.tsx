'use client';

import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';

/**
 * Wrapper do CodeMirror para SQL (destaque de sintaxe + numeração de linhas).
 * Importado via next/dynamic com ssr:false para evitar acesso a `window` no servidor.
 */
export function CodeEditor({
  value,
  onChange,
  height = '220px',
  readOnly = false,
}: {
  value: string;
  onChange?: (v: string) => void;
  height?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <CodeMirror
        value={value}
        height={height}
        readOnly={readOnly}
        extensions={[sql({ dialect: PostgreSQL })]}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true }}
      />
    </div>
  );
}
