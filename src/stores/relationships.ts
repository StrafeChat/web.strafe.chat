import { createStore } from 'solid-js/store';
import { listRelationships, type Relationship } from '../api/relationships';

export const RelType = {
  None: 0,
  Friend: 1,
  Blocked: 2,
  IncomingRequest: 3,
  OutgoingRequest: 4,
  Implicit: 5,
  Suggestion: 6,
} as const;

export interface RelationshipsState {
  relationships: Relationship[];
  loading: boolean;
  hydrated: boolean;
}

export const [relationships, setRelationships] = createStore<RelationshipsState>({
  relationships: [],
  loading: false,
  hydrated: false,
});

export async function loadRelationships(): Promise<void> {
  setRelationships({ loading: true });
  try {
    const list = await listRelationships();
    setRelationships({ relationships: list, loading: false, hydrated: true });
  } catch {
    setRelationships({ loading: false, hydrated: true });
  }
}

export function clearRelationships() {
  setRelationships({ relationships: [], loading: false, hydrated: false });
}

export function friendDisplayName(rel: Relationship): string {
  return rel.user.display_name || rel.user.username || 'Unknown';
}
