import React from 'react';
import { Surface, Heading, Text, Button } from '@/components/filla';
import DriftBadge from '@/components/compliance/DriftBadge';
import { X, AlertTriangle } from 'lucide-react';

interface DriftInfo {
  ruleId: string;
  ruleName: string;
  versionNumber: number;
  propertyName: string;
  driftType: 'outdated' | 'new';
}

interface DriftToTaskModalProps {
  drift: DriftInfo;
  onCreateTask: () => void;
  onClose: () => void;
  isOpen: boolean;
}

export const DriftToTaskModal: React.FC<DriftToTaskModalProps> = ({
  drift,
  onCreateTask,
  onClose,
  isOpen
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Surface variant="floating" className="w-full max-w-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <Heading variant="l">Create Task from Drift</Heading>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <Text variant="label" className="mb-2">Compliance Drift Detected</Text>
            <Surface variant="engraved" className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Text variant="body">{drift.ruleName}</Text>
                <DriftBadge status={drift.driftType} />
              </div>
              <Text variant="caption" className="mb-1">
                Property: {drift.propertyName}
              </Text>
              <Text variant="caption">
                Version: {drift.versionNumber}
              </Text>
            </Surface>
          </div>

          <Text variant="body">
            This will create a compliance task to address the drift and bring the property
            into compliance with the latest rule version.
          </Text>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onCreateTask}>
            Create Task
          </Button>
        </div>
      </Surface>
    </div>
  );
};
