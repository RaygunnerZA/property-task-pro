import React from 'react';
import { Surface, Text, Button } from '@/components/filla';
import { TextArea } from '@/components/filla/Input';
import { Save, X } from 'lucide-react';

interface ClauseEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ClauseEditor: React.FC<ClauseEditorProps> = ({
  value,
  onChange,
  onSave,
  onCancel,
  loading = false
}) => {
  return (
    <Surface variant="neomorphic" className="p-4 border-t border-white/60">
      <Text variant="label" className="mb-3 block">Edit Clause</Text>
      
      <TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="Edit clause text..."
        className="mb-3"
      />
      
      <div className="flex gap-2">
        <Button 
          variant="primary" 
          size="sm" 
          onClick={onSave}
          disabled={loading}
        >
          <Save className="w-3 h-3" />
          Save
        </Button>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onCancel}
          disabled={loading}
        >
          <X className="w-3 h-3" />
          Cancel
        </Button>
      </div>
    </Surface>
  );
};
