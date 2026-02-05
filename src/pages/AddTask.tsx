import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';

/**
 * AddTask page - opens CreateTaskModal and returns to previous screen after
 * Supports URL params: propertyId, dueDate
 */
const AddTask = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(true);
  
  // Read optional params from URL
  const propertyId = searchParams.get('propertyId') || undefined;
  const dueDate = searchParams.get('dueDate') || undefined;

  const handleOpenChange = (open: boolean) => {
    setShowModal(open);
    if (!open) {
      // Go back to the previous screen instead of a fixed route
      navigate(-1);
    }
  };

  const handleTaskCreated = () => {
    // Go back to the previous screen instead of navigating to /work/tasks
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background">
      <CreateTaskModal 
        open={showModal} 
        onOpenChange={handleOpenChange}
        onTaskCreated={handleTaskCreated}
        defaultPropertyId={propertyId}
        defaultDueDate={dueDate}
      />
    </div>
  );
};

export default AddTask;
