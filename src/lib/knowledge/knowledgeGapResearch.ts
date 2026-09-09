import type { ProposedKnowledgeCandidate } from "@/lib/knowledge/knowledgeDocumentIntake";

export function applyGapApplicabilityToProposals(
  proposals: ProposedKnowledgeCandidate[],
  jurisdictions: string[],
  topicLabel?: string
): ProposedKnowledgeCandidate[] {
  const merged = [
    ...new Set(
      jurisdictions.map((j) => j.trim()).filter((j) => j && j !== "Unspecified")
    ),
  ];
  return proposals.map((p) => {
    const jurisdictionsNext = [
      ...new Set([...p.applicability.jurisdictions, ...merged].map((j) => j.trim()).filter(Boolean)),
    ];
    return {
      ...p,
      selected: true,
      applicability: {
        ...p.applicability,
        jurisdictions: jurisdictionsNext,
        unscoped: jurisdictionsNext.length === 0 ? Boolean(p.applicability.unscoped) : false,
      },
      attributes:
        topicLabel && !p.attributes.category
          ? { ...p.attributes, category: topicLabel }
          : p.attributes,
    };
  });
}

export function uniqueTopicLabel(topics: string[]): string | undefined {
  const labels = [...new Set(topics.map((t) => t.trim()).filter(Boolean))];
  return labels.length === 1 ? labels[0] : undefined;
}
