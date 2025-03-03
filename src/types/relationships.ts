export interface RelationshipPayload {
  id: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  updated_at: string;
  type: "relationshipCreate" | "relationshipUpdate" | "relationshipAccept" | "relationshipDelete";
}

export interface Relationship {
  id: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
}

export interface RelationshipUpdate {
  relationship: Relationship;
  type: "relationshipCreate" | "relationshipUpdate" | "relationshipAccept" | "relationshipDelete";
}
