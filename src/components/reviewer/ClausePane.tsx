import React, { useState } from "react";
import { Surface, Text, Heading, Button } from "@/components/filla";
import { ClauseEditor } from "./ClauseEditor";
import { AIRewritePanel } from "./AIRewritePanel";
import { ClauseDiffPreview } from "./ClauseDiffPreview";
import { useClauseEditor } from "@/hooks/useClauseEditor";
import { useAIRewrite } from "@/hooks/useAIRewrite";

interface ClausePaneProps {
  clause: any;
  onApprove: () => void;
  onReject: () => void;
  actionsDisabled?: boolean;
}

export function ClausePane({
  clause,
  onApprove,
  onReject,
  actionsDisabled = false,
}: ClausePaneProps) {
  const [showEditor, setShowEditor] = useState(false);

  const editor = useClauseEditor({
    initialText: clause?.text || "",
    clauseId: clause?.id,
  });

  const textForAi = clause
    ? editor.isDirty
      ? editor.edited
      : clause.text || ""
    : "";

  const ai = useAIRewrite({
    clauseText: textForAi,
    criticNotes: clause?.critic_notes ?? null,
  });

  const {
    original,
    edited,
    setEdited,
    save,
    cancel,
    loading: editorLoading,
    isDirty,
  } = editor;

  const {
    loading: aiLoading,
    suggestion,
    reasoning,
    generate,
    accept: acceptAI,
    regenerate,
  } = ai;

  if (!clause) {
    return (
      <Surface
        variant="neomorphic"
        className="flex h-full items-center justify-center p-8"
      >
        <Text variant="muted">Select a clause to review</Text>
      </Surface>
    );
  }

  const handleSaveEdit = async () => {
    await save();
    setShowEditor(false);
  };

  const handleCancelEdit = () => {
    cancel();
    setShowEditor(false);
  };

  const handleAcceptAI = () => {
    setEdited(suggestion);
    acceptAI();
  };

  return (
    <Surface
      variant="neomorphic"
      className="flex h-full flex-col gap-4 overflow-y-auto p-6"
    >
      <Heading variant="l">Clause Review</Heading>

      <Surface variant="engraved" className="p-4">
        <Text variant="label" className="mb-2 block">
          Original Clause
        </Text>
        <Text className="leading-relaxed">{clause.text}</Text>
        {clause.critic_notes && (
          <div className="mt-3 border-t border-concrete/50 pt-3">
            <Text variant="label" className="mb-1 block text-warning">
              Critic Notes
            </Text>
            <Text variant="caption" className="text-muted-foreground">
              {clause.critic_notes}
            </Text>
          </div>
        )}
      </Surface>

      {isDirty && !showEditor && (
        <ClauseDiffPreview original={original} edited={edited} />
      )}

      {!showEditor && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowEditor(true)}
          className="self-start"
        >
          Edit Clause
        </Button>
      )}

      {showEditor && (
        <ClauseEditor
          value={edited}
          onChange={setEdited}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
          loading={editorLoading}
        />
      )}

      <AIRewritePanel
        suggestion={suggestion}
        reasoning={reasoning}
        loading={aiLoading}
        onGenerate={generate}
        onAccept={handleAcceptAI}
        onRegenerate={regenerate}
      />

      <div className="mt-auto flex gap-3 border-t border-concrete/50 pt-4">
        <Button
          variant="primary"
          onClick={onApprove}
          fullWidth
          disabled={actionsDisabled}
        >
          Approve
        </Button>
        <Button
          variant="danger"
          onClick={onReject}
          fullWidth
          disabled={actionsDisabled}
        >
          Reject
        </Button>
      </div>
    </Surface>
  );
}
