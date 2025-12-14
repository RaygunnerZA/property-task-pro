import { useState } from "react";
import { Plus } from 'lucide-react';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';

export const FloatingAddButton = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full bg-accent shadow-fab flex items-center justify-center transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95"
        aria-label="Add task"
      >
        <Plus className="h-6 w-6 text-accent-foreground" />
      </button>

      <CreateTaskModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
      />
    </>
  );
};
