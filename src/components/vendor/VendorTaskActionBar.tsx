import React from 'react';
import { Surface, Button } from '@/components/filla';
import { Play, CheckCircle } from 'lucide-react';
import { AnimatedIcon } from '@/components/ui/AnimatedIcon';

interface VendorTaskActionBarProps {
  status: 'Assigned' | 'In Progress' | 'Completed' | 'Waiting Review';
  onStart: () => void;
  onComplete: () => void;
}

export const VendorTaskActionBar: React.FC<VendorTaskActionBarProps> = ({ 
  status,
  onStart, 
  onComplete 
}) => {
  return (
    <Surface variant="neomorphic" className="p-4">
      <div className="flex gap-3">
        {status === 'Assigned' && (
          <Button 
            variant="primary" 
            fullWidth
            icon={<Play className="w-4 h-4" />}
            onClick={onStart}
          >
            Start Task
          </Button>
        )}

        {status === 'In Progress' && (
          <Button 
            variant="primary" 
            fullWidth
            icon={
              <AnimatedIcon 
                icon={CheckCircle} 
                size={16} 
                animateOnTap
                animation="check"
                initial="incomplete"
                className="text-white"
              />
            }
            onClick={onComplete}
          >
            Mark as Complete
          </Button>
        )}

        {status === 'Waiting Review' && (
          <div className="flex-1 text-center py-3">
            <span className="text-sm text-muted-foreground">Waiting for manager review</span>
          </div>
        )}

        {status === 'Completed' && (
          <div className="flex-1 text-center py-3 flex items-center justify-center gap-2">
            <AnimatedIcon 
              icon={CheckCircle} 
              size={16} 
              animation="check"
              initial="complete"
              className="text-success"
            />
            <span className="text-sm text-success">Task completed</span>
          </div>
        )}
      </div>
    </Surface>
  );
};
