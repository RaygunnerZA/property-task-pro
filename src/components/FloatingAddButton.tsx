import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FloatingAddButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/add-task')}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50
                 w-14 h-14 rounded-full
                 bg-accent text-white
                 shadow-fab hover:brightness-110
                 border border-white/20
                 flex items-center justify-center
                 transition-all duration-200
                 active:scale-95"
      aria-label="Add task"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
};
