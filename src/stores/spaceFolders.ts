import { createSignal } from 'solid-js';

export interface SpaceFolder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  useSpaceIcons?: boolean;
  collapsed?: boolean;
  spaceIds: string[];
  order: number;
}

const KEY = 'strafe-space-folders';

export const DEFAULT_FOLDER_COLOR = '#5865f2';

function readStored(): SpaceFolder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is SpaceFolder => {
        if (!x || typeof x !== 'object') return false;
        const f = x as Partial<SpaceFolder>;
        return (
          typeof f.id === 'string' &&
          typeof f.name === 'string' &&
          Array.isArray(f.spaceIds) &&
          typeof f.order === 'number'
        );
      })
      .map((f) => ({
        ...f,
        useSpaceIcons: f.useSpaceIcons === true,
        spaceIds: f.spaceIds.filter((id): id is string => typeof id === 'string' && id.length > 0),
      }));
  } catch {
    return [];
  }
}

const [folders, setFolders] = createSignal<SpaceFolder[]>(readStored());

function save(next: SpaceFolder[]) {
  setFolders(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

function generateId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function withoutSpace(list: SpaceFolder[], spaceId: string, keepId: string | null): SpaceFolder[] {
  return list.map((f) =>
    f.id === keepId || !f.spaceIds.includes(spaceId)
      ? f
      : { ...f, spaceIds: f.spaceIds.filter((id) => id !== spaceId) }
  );
}

export const spaceFolders = {
  all: (): SpaceFolder[] => [...folders()].sort((a, b) => a.order - b.order),
  get: (id: string): SpaceFolder | undefined => folders().find((f) => f.id === id),
  folderForSpace: (spaceId: string): SpaceFolder | undefined =>
    folders().find((f) => f.spaceIds.includes(spaceId)),
  create: (
    name: string,
    options: Partial<Pick<SpaceFolder, 'color' | 'icon' | 'useSpaceIcons' | 'collapsed'>> & { spaceIds?: string[] } = {}
  ): SpaceFolder => {
    const all = folders();
    const order = all.length > 0 ? Math.max(...all.map((f) => f.order)) + 1 : 0;
    const seedIds = (options.spaceIds ?? []).filter((id, i, arr) => id && arr.indexOf(id) === i);
    const folder: SpaceFolder = {
      id: generateId(),
      name,
      color: options.color || DEFAULT_FOLDER_COLOR,
      icon: options.icon || undefined,
      useSpaceIcons: options.useSpaceIcons ?? false,
      collapsed: options.collapsed ?? false,
      spaceIds: seedIds,
      order,
    };

    const next = seedIds.reduce((list, id) => withoutSpace(list, id, folder.id), [...all, folder]);
    save(next);
    return folder;
  },
  update: (id: string, updates: Partial<Omit<SpaceFolder, 'id'>>): void => {
    save(
      folders().map((f) =>
        f.id === id
          ? {
              ...f,
              ...updates,
            }
          : f
      )
    );
  },
  remove: (id: string): void => {
    save(folders().filter((f) => f.id !== id));
  },

  setSpaceFolder: (spaceId: string, folderId: string | null, index?: number): void => {
    const all = folders();
    const next = withoutSpace(all, spaceId, folderId);
    if (!folderId) {
      save(next);
      return;
    }
    save(
      next.map((f) => {
        if (f.id !== folderId) return f;
        const existing = f.spaceIds.indexOf(spaceId);
        if (existing >= 0 && index === undefined) return f;
        const ids = f.spaceIds.filter((id) => id !== spaceId);
        const at = index === undefined ? ids.length : Math.max(0, Math.min(index, ids.length));
        ids.splice(at, 0, spaceId);
        return { ...f, spaceIds: ids, collapsed: false };
      })
    );
  },
  addSpace: (folderId: string, spaceId: string): void => spaceFolders.setSpaceFolder(spaceId, folderId),
  removeSpace: (spaceId: string): void => spaceFolders.setSpaceFolder(spaceId, null),
  moveSpace: (spaceId: string, fromFolderId: string | null, toFolderId: string | null, index?: number): void => {
    let all = folders();
    if (fromFolderId) {
      all = all.map((f) =>
        f.id === fromFolderId ? { ...f, spaceIds: f.spaceIds.filter((id) => id !== spaceId) } : f
      );
    }
    if (!toFolderId) {
      save(all);
      return;
    }
    all = all.map((f) => {
      if (f.id !== toFolderId) return f;
      const ids = f.spaceIds.filter((id) => id !== spaceId);
      if (index !== undefined && index >= 0 && index <= ids.length) {
        ids.splice(index, 0, spaceId);
      } else {
        ids.push(spaceId);
      }
      return { ...f, spaceIds: ids };
    });
    save(all);
  },
  reorder: (folderIds: string[]): void => {
    const all = folders();
    const map = new Map(all.map((f) => [f.id, f]));
    const reordered = folderIds
      .map((id, order) => {
        const f = map.get(id);
        if (!f) return null;
        return { ...f, order };
      })
      .filter((f): f is SpaceFolder => f !== null);
    for (const f of all) {
      if (!reordered.find((r) => r.id === f.id)) {
        reordered.push({ ...f, order: reordered.length });
      }
    }
    save(reordered);
  },
  reorderSpacesInFolder: (folderId: string, spaceIds: string[]): void => {
    save(
      folders().map((f) => {
        if (f.id !== folderId) return f;
        return { ...f, spaceIds };
      })
    );
  },

  prune: (knownSpaceIds: ReadonlySet<string>): void => {
    const all = folders();
    let changed = false;
    const next = all.map((f) => {
      const ids = f.spaceIds.filter((id) => knownSpaceIds.has(id));
      if (ids.length === f.spaceIds.length) return f;
      changed = true;
      return { ...f, spaceIds: ids };
    });
    if (changed) save(next);
  },
  clear: () => {
    setFolders([]);
    try {
      localStorage.removeItem(KEY);
    } catch {
      return;
    }
  },
};
