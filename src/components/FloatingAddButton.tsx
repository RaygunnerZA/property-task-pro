import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { colors, shadows } from '@/components/filla/DesignSystem';

export const FloatingAddButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/add-task')}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50
                 w-14 h-14 rounded-full
                 flex items-center justify-center
                 transition-all duration-200
                 hover:scale-105 hover:brightness-110
                 active:scale-95"
      style={{
        backgroundColor: colors.accent,
        boxShadow: shadows.fab
      }}
      aria-label="Add task"
    >
      <Plus className="h-6 w-6 text-white" />
    </button>
  );
};
