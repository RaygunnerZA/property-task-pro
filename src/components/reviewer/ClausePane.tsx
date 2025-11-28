import React, { useState } from 'react';
import { Surface, Text, Heading, Button } from '@/components/filla';
import { ClauseEditor } from './ClauseEditor';
import { AIRewritePanel } from './AIRewritePanel';
import { ClauseDiffPreview } from './ClauseDiffPreview';
import { useClauseEditor } from '@/hooks/useClauseEditor';
import { useAIRewrite } from '@/hooks/useAIRewrite';

interface ClausePaneProps {
  clause: any;
  onApprove: () => void;
  onReject: () => void;
}

export function ClausePane({ clause, onApprove, onReject }: ClausePaneProps) {
  const [showEditor, setShowEditor] = useState(false);
  
  const {
    original,
    edited,
    setEdited,
    save,
    cancel,
    loading: editorLoading,
    isDirty
  } = useClauseEditor({ 
    initialText: clause?.text || '', 
    clauseId: clause?.id 
  });

  const {
    loading: aiLoading,
    suggestion,
    reasoning,
    generate,
    accept: acceptAI,
    regenerate
  } = useAIRewrite(clause?.id);

  if (!clause) {
    return (
      <Surface variant="neomorphic" className="p-8 h-full flex items-center justify-center">
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
    <Surface variant="neomorphic" className="p-6 h-full flex flex-col gap-4 overflow-y-auto">
      <Heading variant="l">Clause Review</Heading>
      
      {/* Original Clause Text */}
      <Surface variant="engraved" className="p-4">
        <Text variant="label" className="mb-2 block">Original Clause</Text>
        <Text className="leading-relaxed">{clause.text}</Text>
        {clause.critic_notes && (
          <div className="mt-3 pt-3 border-t border-concrete/50">
            <Text variant="label" className="mb-1 block text-warning">Critic Notes</Text>
            <Text variant="caption" className="text-muted-foreground">
              {clause.critic_notes}
            </Text>
          </div>
        )}
      </Surface>

      {/* Show diff preview if edited */}
      {isDirty && !showEditor && (
        <ClauseDiffPreview original={original} edited={edited} />
      )}

      {/* Editor Toggle */}
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

      {/* Clause Editor */}
      {showEditor && (
        <ClauseEditor
          value={edited}
          onChange={setEdited}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
          loading={editorLoading}
        />
      )}

      {/* AI Rewrite Panel */}
      <AIRewritePanel
        suggestion={suggestion}
        reasoning={reasoning}
        loading={aiLoading}
        onGenerate={generate}
        onAccept={handleAcceptAI}
        onRegenerate={regenerate}
      />

      {/* Approve/Reject Actions */}
      <div className="flex gap-3 pt-4 border-t border-concrete/50 mt-auto">
        <Button variant="primary" onClick={onApprove} fullWidth>
          Approve
        </Button>
        <Button variant="danger" onClick={onReject} fullWidth>
          Reject
        </Button>
      </div>
    </Surface>
  );
}
