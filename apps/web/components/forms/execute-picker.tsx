'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { NativeSelect } from '@/components/ui/select';
import { type ExecuteSelection, type FormOption, type OrgNodeOption, areasOf, formOptionLabel, sectorsOf } from '@/lib/forms/execute';

/**
 * Escolha do que vai ser inspecionado: Área → Setor → Formulário.
 *
 * O setor é filtrado pela área porque a árvore organizacional já diz quem é
 * filho de quem — oferecer todos os setores obrigaria o executor a saber de cor
 * a que área cada um pertence, e um setor errado joga o resultado no indicador
 * da área errada.
 */
export type { ExecuteSelection, FormOption, OrgNodeOption };

export function ExecutePicker({
  nodes,
  forms,
  value,
  onChange,
}: {
  nodes: OrgNodeOption[];
  forms: FormOption[];
  value: ExecuteSelection;
  onChange: (value: ExecuteSelection) => void;
}) {
  const areas = useMemo(() => areasOf(nodes), [nodes]);
  const setores = useMemo(() => sectorsOf(nodes, value.areaId), [nodes, value.areaId]);

  return (
    <div className="grid gap-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Área</span>
        <NativeSelect
          value={value.areaId}
          onChange={(event) =>
            // Trocar de área invalida o setor: ele pertencia à árvore anterior.
            onChange({ ...value, areaId: event.target.value, sectorId: '' })
          }
        >
          <option value="">Selecione a área</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>{area.name}</option>
          ))}
        </NativeSelect>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Setor</span>
        <NativeSelect
          value={value.sectorId}
          disabled={!value.areaId}
          onChange={(event) => onChange({ ...value, sectorId: event.target.value })}
        >
          <option value="">{value.areaId ? 'Selecione o setor' : 'Escolha a área primeiro'}</option>
          {setores.map((setor) => (
            <option key={setor.id} value={setor.id}>{setor.name}</option>
          ))}
        </NativeSelect>
        {value.areaId && setores.length === 0 && (
          <span className="mt-1 block text-xs text-muted-foreground">
            Esta área não tem setores cadastrados na árvore organizacional.
          </span>
        )}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Formulário</span>
        <NativeSelect value={value.templateId} onChange={(event) => onChange({ ...value, templateId: event.target.value })}>
          <option value="">Selecione o formulário</option>
          {forms.map((form) => (
            <option key={form.id} value={form.id}>{formOptionLabel(form)}</option>
          ))}
        </NativeSelect>
      </label>

      <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        O resultado desta inspeção entra na média do setor no mês, para o indicador de conformidade.
      </p>
    </div>
  );
}
