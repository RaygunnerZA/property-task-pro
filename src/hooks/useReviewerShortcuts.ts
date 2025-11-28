import { useEffect } from 'react';

interface ReviewerActions {
  accept?: () => void;
  reject?: () => void;
  acceptRewrite?: () => void;
  edit?: () => void;
  next?: () => void;
  prev?: () => void;
}

export const useReviewerShortcuts = (actions: ReviewerActions) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'a') actions.accept?.();
      if (e.key === 'r') actions.reject?.();
      if (e.key === 'w') actions.acceptRewrite?.();
      if (e.key === 'e') actions.edit?.();
      if (e.key === 'ArrowRight') actions.next?.();
      if (e.key === 'ArrowLeft') actions.prev?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
};
