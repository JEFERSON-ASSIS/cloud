export type SelectableItem = {
  id: string;
  kind: "folder" | "document";
  shared?: boolean;
  virtual?: boolean;
};

/**
 * Pasta e documento podem ter o mesmo id, então a chave carrega o tipo.
 */
export function selectionKey(item: SelectableItem) {
  return `${item.kind}-${item.id}`;
}

/**
 * Espelha a regra de `action()`: item compartilhado por outra secretaria ou
 * pasta virtual não aceita alteração, e nada é editável em modo leitura.
 */
export function isSelectable(item: SelectableItem, isReadOnly: boolean) {
  if (isReadOnly) return false;
  return !item.shared && !item.virtual;
}

export function selectableKeys(items: SelectableItem[], isReadOnly: boolean) {
  return items
    .filter((item) => isSelectable(item, isReadOnly))
    .map((item) => selectionKey(item));
}

export function toggleSelection(selected: Set<string>, key: string) {
  const next = new Set(selected);
  if (!next.delete(key)) next.add(key);
  return next;
}

export function toggleSelectAll(
  selected: Set<string>,
  items: SelectableItem[],
  isReadOnly: boolean,
) {
  const keys = selectableKeys(items, isReadOnly);
  const allSelected = keys.length > 0 && keys.every((key) => selected.has(key));
  return allSelected ? new Set<string>() : new Set(keys);
}
