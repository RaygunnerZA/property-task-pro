import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';

/**
 * Legacy AddTask page - now redirects to dashboard with modal open
 * This maintains backward compatibility for any deep links to /add-task
 */
const AddTask = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(true);

  const handleOpenChange = (open: boolean) => {
    setShowModal(open);
    if (!open) {
      navigate('/');
    }
  };

  const handleTaskCreated = () => {
    navigate('/work/tasks');
  };

  return (
    <div className="min-h-screen bg-background">
      <CreateTaskModal 
        open={showModal} 
        onOpenChange={handleOpenChange}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
};

export default AddTask;
