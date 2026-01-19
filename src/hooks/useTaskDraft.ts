import { useState, useEffect, useCallback } from 'react';

const DRAFT_STORAGE_KEY = 'filla_task_draft';

export interface TaskDraft {
  title: string;
  description: string;
  propertyId: string;
  selectedPropertyIds: string[];
  selectedSpaceIds: string[];
  priority: string;
  dueDate: string;
  repeatRule?: any;
  assignedUserId?: string;
  assignedTeamIds: string[];
  pendingInvitations: any[];
  isCompliance: boolean;
  complianceLevel: string;
  annotationRequired: boolean;
  templateId: string;
  subtasks: any[];
  selectedThemeIds: string[];
  selectedAssetIds: string[];
  images: any[];
  showAdvanced: boolean;
  activeSection: string | null;
  aiTitleGenerated: string;
  userEditedTitle: boolean;
  showTitleField: boolean;
  appliedChips: any[];
  selectedChipIds: string[];
}

/**
 * Hook to manage task creation draft
 * Saves draft to localStorage when form has content
 * Restores draft when modal opens
 */
export function useTaskDraft() {
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setDraft(parsed);
      } catch (e) {
        console.error('Failed to parse task draft:', e);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }
  }, []);

  /**
   * Clear draft from localStorage
   */
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraft(null);
  }, []);

  /**
   * Save draft to localStorage
   * Only saves if form has meaningful content
   */
  const saveDraft = useCallback((formData: Partial<TaskDraft>) => {
    // Check if form has meaningful content
    const hasContent = 
      formData.title?.trim() ||
      formData.description?.trim() ||
      (formData.selectedPropertyIds && formData.selectedPropertyIds.length > 0) ||
      formData.dueDate ||
      formData.assignedUserId ||
      (formData.assignedTeamIds && formData.assignedTeamIds.length > 0) ||
      (formData.subtasks && formData.subtasks.length > 0) ||
      (formData.selectedThemeIds && formData.selectedThemeIds.length > 0) ||
      (formData.selectedAssetIds && formData.selectedAssetIds.length > 0) ||
      (formData.images && formData.images.length > 0);

    if (hasContent) {
      const draftToSave: TaskDraft = {
        title: formData.title || '',
        description: formData.description || '',
        propertyId: formData.propertyId || '',
        selectedPropertyIds: formData.selectedPropertyIds || [],
        selectedSpaceIds: formData.selectedSpaceIds || [],
        priority: formData.priority || 'medium',
        dueDate: formData.dueDate || '',
        repeatRule: formData.repeatRule,
        assignedUserId: formData.assignedUserId,
        assignedTeamIds: formData.assignedTeamIds || [],
        pendingInvitations: formData.pendingInvitations || [],
        isCompliance: formData.isCompliance || false,
        complianceLevel: formData.complianceLevel || '',
        annotationRequired: formData.annotationRequired || false,
        templateId: formData.templateId || '',
        subtasks: formData.subtasks || [],
        selectedThemeIds: formData.selectedThemeIds || [],
        selectedAssetIds: formData.selectedAssetIds || [],
        images: formData.images || [],
        showAdvanced: formData.showAdvanced || false,
        activeSection: formData.activeSection || null,
        aiTitleGenerated: formData.aiTitleGenerated || '',
        userEditedTitle: formData.userEditedTitle || false,
        showTitleField: formData.showTitleField || false,
        appliedChips: formData.appliedChips || [],
        selectedChipIds: formData.selectedChipIds || [],
      };
      
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftToSave));
      setDraft(draftToSave);
    } else {
      // Clear draft if form is empty
      clearDraft();
    }
  }, [clearDraft]);

  /**
   * Get current draft
   */
  const getDraft = useCallback(() => {
    return draft;
  }, [draft]);

  return {
    draft,
    saveDraft,
    clearDraft,
    getDraft,
  };
}
