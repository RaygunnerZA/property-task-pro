import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VendorTaskStatusBadge } from '@/components/vendor/VendorTaskStatusBadge';
import { VendorTaskActionBar } from '@/components/vendor/VendorTaskActionBar';
import { VendorEvidenceUpload } from '@/components/vendor/VendorEvidenceUpload';
import { VendorPhotoViewer } from '@/components/vendor/VendorPhotoViewer';
import { VendorCommentThread } from '@/components/vendor/VendorCommentThread';
import { SLAIndicator } from '@/components/vendor/SLAIndicator';
import { useVendorTaskDetail } from '@/hooks/vendor/useVendorTaskDetail';
import { MapPin, Calendar, AlertCircle, CheckSquare } from 'lucide-react';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { Card } from '@/components/ui/card';

export default function VendorTaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { task, isLoading, updateStatus } = useVendorTaskDetail(taskId || '');

  if (isLoading) {
    return (
      <StandardPageWithBack
        title="Task Detail"
        backTo="/vendor/tasks"
        icon={<CheckSquare className="h-6 w-6" />}
        maxWidth="lg"
      >
        <LoadingState message="Loading task..." />
      </StandardPageWithBack>
    );
  }

  if (!task) {
    return (
      <StandardPageWithBack
        title="Task Detail"
        backTo="/vendor/tasks"
        icon={<CheckSquare className="h-6 w-6" />}
        maxWidth="lg"
      >
        <EmptyState
          icon={CheckSquare}
          title="Task not found"
          description="The task you're looking for doesn't exist"
        />
      </StandardPageWithBack>
    );
  }

  return (
    <StandardPageWithBack
      title={task.title}
      backTo="/vendor/tasks"
      icon={<CheckSquare className="h-6 w-6" />}
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Task Info */}
        <Card className="p-6 shadow-e1 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold">{task.title}</h2>
            <VendorTaskStatusBadge status={task.status} />
          </div>

          <p className="text-foreground">{task.description}</p>

          <div className="space-y-2 pt-4 border-t border-border">
            {task.property_name && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{task.property_name}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Due: {new Date(task.due_at).toLocaleDateString()}
              </span>
            </div>

            {task.priority === 'high' && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">High Priority</span>
              </div>
            )}
          </div>
        </Card>

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
    </StandardPageWithBack>
  );
}
