'use client';

import { ChevronDown, ChevronUp, Info, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AUTOFILL,
  HEADER_PRESETS,
  type HeaderFieldForm,
  autofillHint,
  headerFieldFromPreset,
} from '@/lib/forms/header';

/**
 * Cabeçalho do formulário — o bloco de contexto que aparece ANTES das perguntas
 * na hora do preenchimento (local, área, tipo de inspeção, quem preencheu,
 * data).
 *
 * Os presets são atalho, não camisa de força: tudo aqui é renomeável,
 * reordenável e removível, e dá para adicionar campo do zero com qualquer tipo.
 */
export function HeaderBuilder({
  fields,
  fieldTypes,
  fieldLabel,
  onChange,
}: {
  fields: HeaderFieldForm[];
  fieldTypes: string[];
  fieldLabel: (value: string) => string;
  onChange: (fields: HeaderFieldForm[]) => void;
}) {
  const usedPresetCodes = new Set(fields.map((field) => field.code));
  const availablePresets = HEADER_PRESETS.filter((preset) => !usedPresetCodes.has(preset.code));

  function update(index: number, patch: Partial<HeaderFieldForm>) {
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  }

  function remove(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-l-4 border-l-sky-500 bg-white p-5 shadow-sm dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            Cabeçalho do preenchimento
            <Badge variant="outline" className="text-[10px]">antes das perguntas</Badge>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Contexto do registro: local, área, tipo de inspeção, responsável e data. Aparece no topo de cada preenchimento e nos
            relatórios.
          </p>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Sem cabeçalho, o preenchimento começa direto nas perguntas. Use as sugestões abaixo ou adicione um campo do zero.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {fields.map((field, index) => (
            <div key={`${field.code || 'campo'}-${index}`} className="rounded-lg border p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_200px]">
                <Input
                  value={field.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  placeholder="Nome do campo (ex.: Local)"
                  className="rounded-none border-0 border-b px-0 font-medium shadow-none focus-visible:border-primary focus-visible:ring-0"
                />
                <NativeSelect value={field.type} onChange={(event) => update(index, { type: event.target.value })}>
                  {fieldTypes.map((value) => (
                    <option key={value} value={value}>{fieldLabel(value)}</option>
                  ))}
                </NativeSelect>
              </div>

              {['SELECT', 'MULTISELECT', 'RADIO', 'CHECKBOX'].includes(field.type) && (
                <Input
                  value={field.options}
                  onChange={(event) => update(index, { options: event.target.value })}
                  placeholder="Opções separadas por vírgula"
                  className="mt-2 text-xs"
                />
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2.5 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={field.required} onChange={(event) => update(index, { required: event.target.checked })} />
                  Obrigatório
                </label>

                <label className="flex items-center gap-1.5">
                  Preencher sozinho
                  <NativeSelect
                    value={field.defaultValue}
                    onChange={(event) => update(index, { defaultValue: event.target.value })}
                    className="h-8 w-44 text-xs"
                  >
                    <option value="">Não (digitado)</option>
                    <option value={AUTOFILL.currentUser}>Quem está preenchendo</option>
                    <option value={AUTOFILL.orgNode}>Área do usuário</option>
                    <option value={AUTOFILL.now}>Data e hora de início</option>
                    <option value={AUTOFILL.today}>Data de hoje</option>
                  </NativeSelect>
                </label>

                <div className="ml-auto flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Mover para cima" onClick={() => move(index, -1)} disabled={index === 0}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Mover para baixo" onClick={() => move(index, 1)} disabled={index === fields.length - 1}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-status-red" title="Remover do cabeçalho" onClick={() => remove(index)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {autofillHint(field.defaultValue) && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Info className="h-3 w-3 shrink-0" /> {autofillHint(field.defaultValue)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {availablePresets.length > 0 && (
          <>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5" /> Sugestões:
            </span>
            {availablePresets.map((preset) => (
              <Button
                key={preset.code}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onChange([...fields, headerFieldFromPreset(preset)])}
              >
                <Plus className="mr-1 h-3 w-3" /> {preset.label}
              </Button>
            ))}
          </>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-dashed text-xs"
          onClick={() => onChange([...fields, { code: '', label: '', type: 'TEXT', required: false, defaultValue: '', options: '' }])}
        >
          <Plus className="mr-1 h-3 w-3" /> Campo em branco
        </Button>
      </div>
    </div>
  );
}
