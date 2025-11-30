import { create } from 'zustand';

interface OnboardingState {
  // User data
  email: string;
  password: string;
  userId: string | null;
  
  // Organisation data
  orgName: string;
  orgSlug: string;
  orgId: string | null;
  
  // Property data
  propertyNickname: string;
  propertyAddress: string;
  propertyUnits: number;
  propertyIcon: string;
  propertyIconColor: string;
  
  // Team invites
  teamInvites: Array<{ email: string; role: string }>;
  
  // Preferences
  aiEnabled: boolean;
  taskSuggestions: boolean;
  timezone: string;
  units: 'metric' | 'imperial';
  
  // Actions
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setUserId: (userId: string | null) => void;
  setOrgName: (name: string) => void;
  setOrgSlug: (slug: string) => void;
  setOrgId: (id: string | null) => void;
  setPropertyNickname: (nickname: string) => void;
  setPropertyAddress: (address: string) => void;
  setPropertyUnits: (units: number) => void;
  setPropertyIcon: (icon: string) => void;
  setPropertyIconColor: (color: string) => void;
  addTeamInvite: (invite: { email: string; role: string }) => void;
  removeTeamInvite: (index: number) => void;
  setAiEnabled: (enabled: boolean) => void;
  setTaskSuggestions: (enabled: boolean) => void;
  setTimezone: (timezone: string) => void;
  setUnits: (units: 'metric' | 'imperial') => void;
  reset: () => void;
}

const initialState = {
  email: '',
  password: '',
  userId: null,
  orgName: '',
  orgSlug: '',
  orgId: null,
  propertyNickname: '',
  propertyAddress: '',
  propertyUnits: 1,
  propertyIcon: 'home',
  propertyIconColor: '#FF6B6B',
  teamInvites: [],
  aiEnabled: true,
  taskSuggestions: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  units: 'metric' as const,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  
  setEmail: (email) => set({ email }),
  setPassword: (password) => set({ password }),
  setUserId: (userId) => set({ userId }),
  setOrgName: (orgName) => {
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    set({ orgName, orgSlug: slug });
  },
  setOrgSlug: (orgSlug) => set({ orgSlug }),
  setOrgId: (orgId) => set({ orgId }),
  setPropertyNickname: (propertyNickname) => set({ propertyNickname }),
  setPropertyAddress: (propertyAddress) => set({ propertyAddress }),
  setPropertyUnits: (propertyUnits) => set({ propertyUnits }),
  setPropertyIcon: (propertyIcon) => set({ propertyIcon }),
  setPropertyIconColor: (propertyIconColor) => set({ propertyIconColor }),
  addTeamInvite: (invite) => set((state) => ({ 
    teamInvites: [...state.teamInvites, invite] 
  })),
  removeTeamInvite: (index) => set((state) => ({ 
    teamInvites: state.teamInvites.filter((_, i) => i !== index) 
  })),
  setAiEnabled: (aiEnabled) => set({ aiEnabled }),
  setTaskSuggestions: (taskSuggestions) => set({ taskSuggestions }),
  setTimezone: (timezone) => set({ timezone }),
  setUnits: (units) => set({ units }),
  reset: () => set(initialState),
}));
