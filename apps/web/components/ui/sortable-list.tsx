'use client';

import { useEffect, useState, type ReactNode, type Ref } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SortableHandleProps {
  ref: Ref<HTMLButtonElement>;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable: 'Para reordenar, pressione espaço na alça, use as setas para cima e para baixo e pressione espaço de novo para soltar. Esc cancela.',
};

/**
 * Lista reordenável por arraste (mouse, toque e teclado). O arraste começa só
 * pela alça, então campos dentro da linha continuam editáveis. A ordem muda na
 * hora e `onReorder` recebe os ids na ordem nova.
 */
export function SortableList<T extends { id: string }>({
  items,
  disabled = false,
  onReorder,
  renderItem,
  getLabel = () => 'item',
  className,
}: {
  items: T[];
  disabled?: boolean;
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T, index: number, handle: SortableHandleProps | null) => ReactNode;
  getLabel?: (item: T) => string;
  className?: string;
}) {
  const [order, setOrder] = useState(items);
  useEffect(() => setOrder(items), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = (id: UniqueIdentifier) => {
    const item = order.find((candidate) => candidate.id === id);
    return item ? `"${getLabel(item)}"` : 'item';
  };
  const placeOf = (id: UniqueIdentifier) => `posição ${order.findIndex((item) => item.id === id) + 1} de ${order.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${labelOf(active.id)} pego na ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${labelOf(active.id)} sobre a ${placeOf(over.id)}.` : `${labelOf(active.id)} fora da lista.`),
    onDragEnd: ({ active, over }) => (over ? `${labelOf(active.id)} solto na ${placeOf(over.id)}.` : `${labelOf(active.id)} voltou ao lugar.`),
    onDragCancel: ({ active }) => `Movimento cancelado. ${labelOf(active.id)} voltou ao lugar.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((item) => item.id === active.id);
    const to = order.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(order, from, to);
    setOrder(next);
    onReorder(next.map((item) => item.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order.map((item) => item.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <div className={className}>
          {order.map((item, index) => (
            <SortableRow key={item.id} id={item.id} disabled={disabled}>
              {(handle) => renderItem(item, index, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, disabled, children }: { id: string; disabled: boolean; children: (handle: SortableHandleProps | null) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative rounded-md', isDragging && 'z-10 shadow-lg ring-2 ring-primary/40')}
    >
      {children(disabled ? null : { ref: setActivatorNodeRef, attributes, listeners })}
    </div>
  );
}

/** Alça de arraste da linha; não aparece quando a lista é só leitura. */
export function SortableHandle({ handle, label = 'Reordenar' }: { handle: SortableHandleProps | null; label?: string }) {
  if (!handle) return null;
  return (
    <button
      type="button"
      ref={handle.ref}
      {...handle.attributes}
      {...handle.listeners}
      aria-label={label}
      title="Arraste para reordenar (no teclado: espaço e setas)"
      className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-slate-400 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
