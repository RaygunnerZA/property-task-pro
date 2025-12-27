import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
    <Card className="p-4 shadow-e1 border-t border-white/60">
      <Label className="mb-3 block text-sm font-semibold">Edit Clause</Label>
      
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="Edit clause text..."
        className="mb-3 input-neomorphic"
      />
      
      <div className="flex gap-2">
        <Button 
          variant="default" 
          size="sm" 
          onClick={onSave}
          disabled={loading}
          className="btn-neomorphic"
        >
          <Save className="w-3 h-3 mr-1" />
          Save
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onCancel}
          disabled={loading}
          className="input-neomorphic"
        >
          <X className="w-3 h-3 mr-1" />
          Cancel
        </Button>
      </div>
    </Card>
  );
};
