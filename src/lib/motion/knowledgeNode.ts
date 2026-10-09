export type KnowledgeNodeKind = "source" | "recognised" | "existing" | "knowledge";

export type KnowledgeNode = {
  id: string;
  kind: KnowledgeNodeKind;
  /** Mono caption, e.g. "Document", "Recognised", "On this property". */
  label: string;
  title: string;
  detail?: string | null;
  /** The connection is proposed and happens only when the user confirms (dashed thread + "On save"). */
  pending?: boolean;
};
