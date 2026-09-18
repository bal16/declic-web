import { type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';

import type { TableRow } from './table-schema';

/**
 * Pure reorder: returns the reordered rows, or null when nothing moves
 * (same id, or unknown id). Unit-tested directly — no DOM needed.
 */
export function reorderRows<T extends { id: UniqueIdentifier }>(
  rows: T[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
): T[] | null {
  if (activeId === overId) return null;
  const ids = rows.map((row) => row.id);
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) return null;
  return arrayMove(rows, oldIndex, newIndex);
}

/**
 * Ordered row state + drag-end reorder for the panel data table.
 * Colocated (not src/hooks/): this logic is private to DataTable —
 * promote to a shared location only when a second consumer appears.
 */
export function useOrderedData(
  initialData: TableRow[],
  onOrderChange?: (orderedIds: UniqueIdentifier[]) => void,
) {
  const [data, setData] = useState(() => initialData);

  const dataIds = useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!active || !over) return;
    const next = reorderRows(data, active.id, over.id);
    if (next === null) return;
    setData(next);
    onOrderChange?.(next.map((row) => row.id));
  }

  return { data, dataIds, handleDragEnd };
}
