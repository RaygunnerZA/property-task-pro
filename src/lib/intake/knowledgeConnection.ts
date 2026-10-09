/**
 * How a document connects to existing property knowledge, as KnowledgeThread nodes:
 * document → what was recognised → the asset already on the property → what saving keeps.
 * The last step is always pending: nothing is linked until the user saves.
 */

import type { IntakeAssetMatch } from "@/lib/matchIntakeAssets";
import type { KnowledgeNode } from "@/lib/motion/knowledgeNode";

export interface KnowledgeConnectionInput {
  documentLabel?: string | null;
  asset: IntakeAssetMatch;
  spaceName?: string | null;
  /** A renewal fact read from the document, already formatted for display. */
  renewal?: { label: string; date: string } | null;
}

export function buildKnowledgeConnectionNodes(input: KnowledgeConnectionInput): KnowledgeNode[] {
  const { asset } = input;
  const serial = asset.serial_number?.trim() || null;
  const documentLabel = input.documentLabel?.trim() || "This document";
  const spaceName = input.spaceName?.trim() || null;

  const recognisedBase = { id: "recognised", kind: "recognised", label: "Recognised" } as const;
  const recognised: KnowledgeNode =
    asset.matchedBy === "serial" && serial
      ? { ...recognisedBase, title: `Serial ${serial}`, detail: "Matches the serial on file" }
      : asset.matchedBy === "name"
        ? { ...recognisedBase, title: asset.name, detail: "Matches an asset name on file" }
        : { ...recognisedBase, title: serial ? `${asset.name} · ${serial}` : asset.name };

  const kept: KnowledgeNode = input.renewal
    ? {
        id: "knowledge",
        kind: "knowledge",
        label: "Kept for later",
        title: `${input.renewal.label} ${input.renewal.date}`,
        detail: `Saved with the record, linked to ${asset.name}`,
        pending: true,
      }
    : {
        id: "knowledge",
        kind: "knowledge",
        label: "Kept for later",
        title: `Record linked to ${asset.name}`,
        pending: true,
      };

  return [
    { id: "source", kind: "source", label: "Document", title: documentLabel },
    recognised,
    {
      id: "existing",
      kind: "existing",
      label: "On this property",
      title: asset.name,
      detail: spaceName ? `In ${spaceName}` : null,
    },
    kept,
  ];
}
