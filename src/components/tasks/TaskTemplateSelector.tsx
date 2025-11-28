import React from 'react';
import { Surface, Text, Button } from '@/components/filla';
import { FileText, CheckSquare } from 'lucide-react';

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  subtaskCount: number;
}

interface TaskTemplateSelectorProps {
  templates: TaskTemplate[];
  onSelect: (templateId: string) => void;
}

export const TaskTemplateSelector: React.FC<TaskTemplateSelectorProps> = ({
  templates,
  onSelect
}) => {
  return (
    <Surface variant="neomorphic" className="p-4 border-t border-white/60">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <Text variant="label">Use Template</Text>
      </div>

      {templates.length === 0 ? (
        <Text variant="caption" className="text-center py-4">
          No templates available
        </Text>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <Surface
              key={template.id}
              variant="engraved"
              interactive
              onClick={() => onSelect(template.id)}
              className="p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <Text variant="label" className="mb-1">
                    {template.name}
                  </Text>
                  <Text variant="caption" className="line-clamp-2">
                    {template.description}
                  </Text>
                  <div className="flex items-center gap-1 mt-2">
                    <CheckSquare className="w-3 h-3 text-muted-foreground" />
                    <Text variant="caption">
                      {template.subtaskCount} subtasks
                    </Text>
                  </div>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </Surface>
  );
};
