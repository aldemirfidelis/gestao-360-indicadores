'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

export interface BpmnEditorHandle { xml: () => Promise<string>; svg: () => Promise<string> }
function fitDiagram(instance: any, editable: boolean) {
  const canvas = instance.get('canvas');
  const { inner, outer } = canvas.viewbox();
  const left = editable ? 112 : 24;
  const scale = Math.min(1, Math.max(1, outer.width - left - 24) / Math.max(1, inner.width), Math.max(1, outer.height - 48) / Math.max(1, inner.height));
  canvas.viewbox({ x: inner.x - left / scale, y: inner.y - 24 / scale, width: outer.width / scale, height: outer.height / scale });
}
export function downloadProcessFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const BpmnEditor = forwardRef<BpmnEditorHandle, { xml: string; editable: boolean; onDirty: () => void; onSelect: (id: string | null) => void }>(function BpmnEditor({ xml, editable, onDirty, onSelect }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const modeler = useRef<any>(null);
  const callbacks = useRef({ onDirty, onSelect });
  callbacks.current = { onDirty, onSelect };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<{ id: string; name: string; description: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const changed = () => { dirtyRef.current = true; setDirty(true); callbacks.current.onDirty(); };

  useImperativeHandle(ref, () => ({
    xml: async () => { if (!modeler.current || !ready) throw new Error('Aguarde o carregamento do BPMN.'); const result = await modeler.current.saveXML({ format: true }); if (!result.xml) throw new Error('Não foi possível exportar o XML.'); return result.xml; },
    svg: async () => { if (!modeler.current || !ready) throw new Error('Aguarde o carregamento do BPMN.'); const result = await modeler.current.saveSVG(); if (!result.svg) throw new Error('Não foi possível exportar o SVG.'); return result.svg; },
  }), [ready]);

  useEffect(() => {
    let cancelled = false;
    let instance: any;
    const load = async () => {
      try {
        const Library = editable ? (await import('bpmn-js/lib/Modeler')).default : (await import('bpmn-js/lib/NavigatedViewer')).default;
        if (cancelled || !container.current) return;
        instance = new Library({ container: container.current });
        modeler.current = instance;
        await instance.importXML(xml);
        if (cancelled) return;
        fitDiagram(instance, editable);
        if (editable) instance.on('commandStack.changed', changed);
        instance.on('selection.changed', (event: any) => {
          const element = event.newSelection?.[0];
          const object = element?.businessObject;
          setSelected(object ? { id: object.id, name: object.name || '', description: (object.documentation ?? []).map((entry: any) => entry.text || '').join('\n') } : null);
          callbacks.current.onSelect(object?.id ?? null);
        });
        setReady(true);
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível abrir o BPMN.'); }
    };
    load();
    return () => { cancelled = true; instance?.destroy(); modeler.current = null; };
    // O componente é recriado pela revisão salva; callbacks permanecem atuais pelo ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, xml]);

  const importFile = async (file: File | undefined) => {
    if (!file || !modeler.current) return;
    if (file.size > 2_000_000) { setError('O arquivo BPMN deve ter até 2 MB.'); return; }
    if (dirtyRef.current && !window.confirm('Substituir o desenho atual? Exporte o rascunho se precisar mantê-lo.')) return;
    setImporting(true); setError('');
    let previous: string | undefined;
    try {
      const imported = await file.text();
      await api('/processes/governance/validate-bpmn', { method: 'POST', json: { xml: imported } });
      previous = (await modeler.current.saveXML({ format: true })).xml;
      await modeler.current.importXML(imported);
      fitDiagram(modeler.current, editable);
      changed();
    } catch (err) {
      if (previous) await modeler.current.importXML(previous);
      setError(err instanceof Error ? err.message : 'Falha na importação.');
    } finally { setImporting(false); }
  };

  const updateProperties = () => {
    if (!selected || !editable || !modeler.current) return;
    const element = modeler.current.get('elementRegistry').get(selected.id);
    if (!element) return;
    const documentation = selected.description ? [modeler.current.get('moddle').create('bpmn:Documentation', { text: selected.description })] : [];
    modeler.current.get('modeling').updateProperties(element, { name: selected.name, documentation });
  };

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      {editable && <><Button size="sm" variant="outline" disabled={!ready} onClick={() => modeler.current.get('commandStack').undo()}>Desfazer</Button><Button size="sm" variant="outline" disabled={!ready} onClick={() => modeler.current.get('commandStack').redo()}>Refazer</Button>
        <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm"><span>{importing ? 'Importando...' : 'Importar BPMN XML'}</span><input aria-label="Importar BPMN XML" type="file" accept=".bpmn,.xml,application/xml,text/xml" className="sr-only" disabled={!ready || importing} onChange={(event) => { importFile(event.target.files?.[0]); event.target.value = ''; }} /></label></>}
      <Button size="sm" variant="outline" disabled={!ready} onClick={() => fitDiagram(modeler.current, editable)}>Enquadrar</Button>
      <Button size="sm" variant="outline" disabled={!ready} onClick={() => modeler.current.get('canvas').zoom(modeler.current.get('canvas').zoom() * 1.2)}>Ampliar</Button>
      <Button size="sm" variant="outline" disabled={!ready} onClick={() => modeler.current.get('canvas').zoom(modeler.current.get('canvas').zoom() / 1.2)}>Reduzir</Button>
      {dirty && <span className="text-xs text-amber-700">Desenho com alterações não salvas</span>}
    </div>
    {error && <p role="alert" className="rounded-md border border-status-red/30 p-3 text-sm text-status-red">{error}</p>}
    {!ready && !error && <p className="text-sm text-muted-foreground">Carregando editor BPMN...</p>}
    <div ref={container} data-testid="bpmn-canvas" className="relative h-[62vh] min-h-[400px] w-full overflow-hidden rounded-lg border bg-white text-slate-900" />
    {selected && <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_2fr_auto]">
      <div className="space-y-1"><Label>Nome do elemento</Label><Input aria-label="Nome do elemento BPMN" disabled={!editable} value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })} /></div>
      <div className="space-y-1"><Label>Descrição do elemento</Label><Textarea aria-label="Descrição do elemento BPMN" disabled={!editable} value={selected.description} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></div>
      {editable && <Button className="self-end" onClick={updateProperties}>Aplicar ao desenho</Button>}
    </div>}
    <p className="text-xs text-muted-foreground">Use a paleta para eventos, tarefas, subprocessos, decisões, pools e lanes. Selecione um elemento para editar suas propriedades. Este desenho documenta o processo; as medições e a execução ficam nos registros vinculados.</p>
  </div>;
});
