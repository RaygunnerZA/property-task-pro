import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Surface, Heading, Text, Button } from '@/components/filla';
import { VendorTaskStatusBadge } from '@/components/vendor/VendorTaskStatusBadge';
import { VendorTaskActionBar } from '@/components/vendor/VendorTaskActionBar';
import { VendorEvidenceUpload } from '@/components/vendor/VendorEvidenceUpload';
import { VendorPhotoViewer } from '@/components/vendor/VendorPhotoViewer';
import { VendorCommentThread } from '@/components/vendor/VendorCommentThread';
import { SLAIndicator } from '@/components/vendor/SLAIndicator';
import { useVendorTaskDetail } from '@/hooks/vendor/useVendorTaskDetail';
import { ArrowLeft, MapPin, Calendar, AlertCircle } from 'lucide-react';

export default function VendorTaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { task, isLoading, updateStatus } = useVendorTaskDetail(taskId || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper p-4 flex items-center justify-center">
        <Text variant="muted">Loading task...</Text>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-paper p-4 flex items-center justify-center">
        <Text variant="muted">Task not found</Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-4 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/vendor/tasks')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back
        </Button>
      </div>

      {/* Task Info */}
      <Surface variant="neomorphic" className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <Heading variant="l">{task.title}</Heading>
          <VendorTaskStatusBadge status={task.status} />
        </div>

        <Text variant="body">{task.description}</Text>

        <div className="space-y-2 pt-4 border-t border-concrete">
          {task.property_name && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <Text variant="caption">{task.property_name}</Text>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Text variant="caption">
              Due: {new Date(task.due_at).toLocaleDateString()}
            </Text>
          </div>

          {task.priority === 'high' && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-danger" />
              <Text variant="caption" className="text-danger">High Priority</Text>
            </div>
          )}
        </div>
      </Surface>

      {/* SLA Indicator */}
      <SLAIndicator due_at={task.due_at} />

      {/* Actions */}
      <VendorTaskActionBar
        status={task.status}
        onStart={() => updateStatus('In Progress')}
        onComplete={() => updateStatus('Waiting Review')}
      />

      {/* Evidence Upload */}
      {(task.status === 'In Progress' || task.status === 'Waiting Review') && (
        <VendorEvidenceUpload />
      )}

      {/* Photo Viewer */}
      <VendorPhotoViewer photos={[]} />

      {/* Comments */}
      <VendorCommentThread comments={[]} />
    </div>
  );
}
