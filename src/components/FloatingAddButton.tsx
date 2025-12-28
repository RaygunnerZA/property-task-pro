import { useState } from "react";
import { Plus, Mic } from 'lucide-react';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { AudioRecorder } from '@/components/audio/AudioRecorder';
import { cn } from '@/lib/utils';

interface FloatingAddButtonProps {
  onTaskCreated?: (taskId: string) => void;
}

export const FloatingAddButton = ({ onTaskCreated }: FloatingAddButtonProps = {}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleMainButtonClick = () => {
    if (expanded) {
      setExpanded(false);
    } else {
      setExpanded(true);
    }
  };

  const handleTaskClick = () => {
    setShowCreateModal(true);
    setExpanded(false);
  };

  const handleMicClick = () => {
    setShowAudioRecorder(true);
    setExpanded(false);
  };

  return (
    <>
      {/* Expanded buttons - Fanned out */}
      {expanded && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3 animate-fade-in">
          {/* Mic button - top */}
          <button
            onClick={handleMicClick}
            className="w-12 h-12 rounded-full bg-card shadow-e1 flex items-center justify-center text-primary hover:translate-y-[-2px] transition-transform active:scale-95"
            style={{
              backgroundColor: 'rgba(241, 238, 232, 0.95)',
              boxShadow: '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)'
            }}
            aria-label="Record audio"
          >
            <Mic className="w-5 h-5" />
          </button>
          {/* Task button - bottom */}
          <button
            onClick={handleTaskClick}
            className="w-12 h-12 rounded-full bg-card shadow-e1 flex items-center justify-center text-primary hover:translate-y-[-2px] transition-transform active:scale-95"
            style={{
              backgroundColor: 'rgba(241, 238, 232, 0.95)',
              boxShadow: '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)'
            }}
            aria-label="Add task"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={handleMainButtonClick}
        className={cn(
          "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full shadow-fab flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95",
          expanded
            ? "bg-muted text-muted-foreground rotate-45"
            : "bg-accent text-accent-foreground hover:brightness-110"
        )}
        aria-label={expanded ? "Close menu" : "Open menu"}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Modals */}
      <CreateTaskModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
        onTaskCreated={onTaskCreated}
      />

      <AudioRecorder
        open={showAudioRecorder}
        onOpenChange={setShowAudioRecorder}
      />
    </>
  );
};
