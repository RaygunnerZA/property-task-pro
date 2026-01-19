# CHAPTER 22 — State Management Patterns

**Last Updated:** 2026-01-17  
**Status:** Active Guidelines

---

## 1. PURPOSE

This document establishes clear patterns for state management across the Filla application. Consistent state management patterns reduce bugs, improve performance, and make the codebase more maintainable.

---

## 2. STATE MANAGEMENT HIERARCHY

Filla uses a **layered state management approach** with clear responsibilities for each layer:

```
┌─────────────────────────────────────────────────────┐
│ 1. TanStack Query (React Query)                    │
│    → Server state, API data, caching                │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. React Context                                    │
│    → Global UI state, auth state, app-wide config   │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. Zustand                                         │
│    → Complex client-side workflows (onboarding)     │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 4. Local useState / useReducer                     │
│    → Component-scoped UI state                     │
└─────────────────────────────────────────────────────┘
```

---

## 3. PATTERN DECISION TREE

**Use this decision tree to choose the right state management pattern:**

```
Is the data from the server/API?
├─ YES → Use TanStack Query
│         └─ Is it org-scoped?
│            ├─ YES → Include orgId in queryKey
│            └─ NO → Standard queryKey pattern
│
├─ NO → Is it needed across multiple unrelated components?
│         ├─ YES → Use React Context
│         │         └─ Is it truly global (auth, theme, etc.)?
│         │            ├─ YES → Put in DataContext or dedicated context
│         │            └─ NO → Create feature-specific context
│         │
│         └─ NO → Is it a complex workflow with multiple steps?
│                  ├─ YES → Use Zustand
│                  │         (e.g., multi-step onboarding flow)
│                  │
│                  └─ NO → Use useState / useReducer
│                            (component-scoped state)
```

---

## 4. TANSTACK QUERY (REACT QUERY) — Server State

### When to Use
- ✅ All data fetched from Supabase/API
- ✅ Data that needs caching
- ✅ Data that benefits from automatic refetching
- ✅ Data shared across components

### Best Practices

#### Query Key Patterns
```typescript
// ✅ GOOD: Centralized query keys (recommended pattern)
// src/lib/queryKeys.ts
export const queryKeys = {
  tasks: (orgId?: string) => ['tasks', orgId] as const,
  task: (orgId?: string, taskId?: string) => ['tasks', orgId, taskId] as const,
  taskMessages: (orgId?: string, taskId?: string) => 
    ['taskMessages', orgId, taskId] as const,
  properties: (orgId?: string) => ['properties', orgId] as const,
  activeOrg: (userId?: string) => ['activeOrg', userId] as const,
} as const;

// Usage
useQuery({
  queryKey: queryKeys.tasks(orgId),
  queryFn: () => fetchTasks(orgId),
});
```

```typescript
// ⚠️ AVOID: Inline query keys (harder to invalidate)
useQuery({
  queryKey: ['tasks', orgId, 'some', 'random', 'stuff'], // ❌
  queryFn: () => fetchTasks(orgId),
});
```

#### Always Include orgId for Org-Scoped Data
```typescript
// ✅ GOOD: orgId in queryKey
const { data } = useQuery({
  queryKey: queryKeys.tasks(orgId),
  queryFn: () => fetchTasks(orgId),
  enabled: !!orgId, // Wait for orgId
});

// ❌ BAD: Missing orgId
const { data } = useQuery({
  queryKey: ['tasks'], // Missing orgId!
  queryFn: () => fetchTasks(),
});
```

#### Stale Time Configuration
```typescript
// Use appropriate staleTime based on data volatility:

// Never stale (user/org identity)
useQuery({
  queryKey: queryKeys.activeOrg(userId),
  staleTime: Infinity, // ✅
});

// Long cache (properties, themes)
useQuery({
  queryKey: queryKeys.properties(orgId),
  staleTime: 5 * 60 * 1000, // 5 minutes ✅
});

// Medium cache (tasks, messages)
useQuery({
  queryKey: queryKeys.tasks(orgId),
  staleTime: 60 * 1000, // 1 minute ✅ (default)
});

// Real-time data (use subscriptions instead)
// Don't use React Query for real-time data
```

#### Converting from useState + useEffect
```typescript
// ❌ OLD PATTERN: useState + useEffect
const [tasks, setTasks] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  fetchTasks(orgId)
    .then(setTasks)
    .catch(setError)
    .finally(() => setLoading(false));
}, [orgId]);

// ✅ NEW PATTERN: React Query
const { data: tasks = [], isLoading: loading, error } = useQuery({
  queryKey: queryKeys.tasks(orgId),
  queryFn: () => fetchTasks(orgId),
  enabled: !!orgId,
});
```

### Migration Checklist
When migrating hooks from `useState + useEffect` to React Query:
- [ ] Extract fetch logic to async function
- [ ] Create queryKey using queryKeys factory
- [ ] Add `enabled` flag if query depends on other data
- [ ] Set appropriate `staleTime`
- [ ] Update components to use `data` instead of state
- [ ] Remove manual loading/error state management

---

## 5. REACT CONTEXT — Global UI State

### When to Use
- ✅ Authentication state (session, user)
- ✅ Global UI configuration (theme, layout preferences)
- ✅ App-wide state needed by many unrelated components
- ✅ Data that changes rarely but is accessed frequently

### Best Practices

#### Always Memoize Context Values
```typescript
// ✅ GOOD: Memoized value
const value: ContextValue = useMemo(() => ({
  session,
  user,
  orgId,
  // ... other values
}), [session, user, orgId /* all dependencies */]);

return <Context.Provider value={value}>{children}</Context.Provider>;
```

```typescript
// ❌ BAD: Recreated on every render
const value: ContextValue = {
  session,
  user,
  orgId,
  // This object is NEW every render → all consumers re-render!
};

return <Context.Provider value={value}>{children}</Context.Provider>;
```

#### Use Selective Hooks
```typescript
// ✅ GOOD: Consume only what you need
export function useAuth() {
  const { session, user, isAuthenticated } = useDataContext();
  return { session, user, isAuthenticated };
}

// Usage in component
const { user } = useAuth(); // Only subscribes to auth-related updates
```

```typescript
// ⚠️ AVOID: Consuming entire context when you only need one value
const { session, user, orgId, organisation, userId, isOrgUser, ... } = useDataContext();
// Component re-renders on ANY context change, even if you only use 'user'
```

#### Existing Contexts in Filla

**DataContext** (`src/contexts/DataContext.tsx`)
- Purpose: Authentication, user identity, org identity
- Contains: session, user, orgId, organisation, loading states
- Hooks: `useDataContext()`, `useAuth()`, `useOrg()`, `useCurrentUser()`

**ScheduleContext** (`src/contexts/ScheduleContext.tsx`)
- Purpose: Schedule view state (date range, filters)
- Contains: viewMode, rangeStart, rangeEnd, filters

**ActiveOrgProvider** (`src/providers/ActiveOrgProvider.tsx`)
- Purpose: Optimized orgId access (calls useActiveOrg once at root)
- Contains: orgId, isLoading, error

---

## 6. ZUSTAND — Complex Client Workflows

### When to Use
- ✅ Multi-step workflows (onboarding, wizards)
- ✅ Complex client-side state with multiple related pieces
- ✅ State that needs persistence across navigation
- ✅ State with complex derived values

### Best Practices

#### Keep Stores Focused
```typescript
// ✅ GOOD: Single-purpose store
export const useOnboardingStore = create<OnboardingState>((set) => ({
  step: 1,
  email: '',
  orgName: '',
  // ... only onboarding-related state
}));

// ❌ BAD: Multi-purpose store
export const useAppStore = create((set) => ({
  // Mixing unrelated concerns
  onboarding: { ... },
  tasks: { ... },
  userPreferences: { ... },
}));
```

#### Use TypeScript
```typescript
// ✅ GOOD: Fully typed
interface OnboardingState {
  step: number;
  email: string;
  // ... all properties typed
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  // Implementation
}));
```

#### Existing Zustand Stores in Filla

**useOnboardingStore** (`src/hooks/useOnboardingStore.ts`)
- Purpose: Multi-step onboarding flow state
- Contains: user data, org data, property data, preferences
- Persists across onboarding screens

---

## 7. LOCAL STATE (useState / useReducer)

### When to Use
- ✅ Component-scoped UI state (modals, dropdowns, form inputs)
- ✅ Temporary state that doesn't need to persist
- ✅ State that's only used within a single component tree
- ✅ Simple state without complex logic

### Best Practices

#### Use useReducer for Complex State Logic
```typescript
// ✅ GOOD: useReducer for complex state
const [state, dispatch] = useReducer(taskReducer, initialState);

// Better than multiple useState calls for related state
```

#### Lift State Up When Needed
```typescript
// If state is needed by sibling components, lift it up to parent
// If needed by many unrelated components, consider Context
```

---

## 8. COMMON PATTERNS

### Pattern: Org-Scoped Queries
```typescript
// Always pattern:
const { orgId } = useActiveOrg(); // Or useOrg() from DataContext

const { data } = useQuery({
  queryKey: queryKeys.something(orgId),
  queryFn: () => fetchSomething(orgId),
  enabled: !!orgId, // ⚠️ Always wait for orgId
});
```

### Pattern: Optimistic Updates
```typescript
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: updateTask,
  onMutate: async (newTask) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: queryKeys.tasks(orgId) });
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKeys.tasks(orgId));
    
    // Optimistically update
    queryClient.setQueryData(queryKeys.tasks(orgId), (old) => 
      old.map(t => t.id === newTask.id ? newTask : t)
    );
    
    return { previous };
  },
  onError: (err, newTask, context) => {
    // Rollback on error
    queryClient.setQueryData(queryKeys.tasks(orgId), context.previous);
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks(orgId) });
  },
});
```

### Pattern: Dependent Queries
```typescript
// Query B depends on Query A
const { data: property } = useQuery({
  queryKey: queryKeys.property(orgId, propertyId),
  queryFn: () => fetchProperty(propertyId),
  enabled: !!orgId && !!propertyId,
});

const { data: spaces } = useQuery({
  queryKey: queryKeys.spaces(orgId, propertyId),
  queryFn: () => fetchSpaces(propertyId),
  enabled: !!property?.id, // ⚠️ Wait for property
});
```

---

## 9. ANTI-PATTERNS TO AVOID

### ❌ Storing Server Data in Context
```typescript
// ❌ BAD: Server data in Context
const [tasks, setTasks] = useState([]);
useEffect(() => {
  fetchTasks().then(setTasks);
}, []);
// Use React Query instead!
```

### ❌ Creating Context for Component Props
```typescript
// ❌ BAD: Context for simple prop passing
// Just pass props or lift state up
```

### ❌ Using useState + useEffect for Server Data
```typescript
// ❌ BAD: Manual fetching
const [data, setData] = useState();
useEffect(() => {
  fetchData().then(setData);
}, []);
// Use React Query instead!
```

### ❌ Recreating Context Values
```typescript
// ❌ BAD: New object every render
const value = { user, orgId };
// Always use useMemo!
```

---

## 10. PERFORMANCE CONSIDERATIONS

### Context Performance
- ✅ Memoize context values
- ✅ Use selective hooks (only subscribe to needed values)
- ✅ Split large contexts into smaller ones
- ✅ Avoid putting frequently changing values in context

### React Query Performance
- ✅ Set appropriate `staleTime` to reduce refetches
- ✅ Use `enabled` to prevent unnecessary queries
- ✅ Invalidate queries strategically (not on every render)
- ✅ Use `select` option to subscribe to only needed data

### Zustand Performance
- ✅ Use selectors to prevent unnecessary re-renders
```typescript
// ✅ GOOD: Selector
const email = useOnboardingStore(state => state.email);

// ❌ BAD: Entire store
const store = useOnboardingStore();
```

---

## 11. MIGRATION PATH

### Current State
- ✅ TanStack Query: Used for most server data (good!)
- ✅ Context: Used for auth/global state (good!)
- ⚠️ Some hooks still use useState + useEffect (migrate these)

### Migration Priority
1. **High Priority:** Migrate hooks that fetch org-scoped data
   - `useTaskMessages` → React Query
   - `useReminders` → React Query
   - `useSubtasks` → React Query
   - `useInitialOrgQueries` → React Query (or split into separate queries)

2. **Medium Priority:** Optimize existing Context usage
   - ✅ DataContext value memoization (DONE)
   - Review other contexts for memoization

3. **Low Priority:** Refactor complex components
   - Split large components that mix concerns
   - Extract state logic to custom hooks

---

## 12. EXAMPLES

### Example: Fetching Tasks
```typescript
// ✅ GOOD: React Query pattern
export function useTasks(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.tasks(orgId),
    queryFn: () => fetchTasks(orgId!),
    enabled: !!orgId,
  });
}
```

### Example: Global Theme State
```typescript
// ✅ GOOD: Context for global UI state
const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  
  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light'),
  }), [theme]);
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### Example: Onboarding Flow
```typescript
// ✅ GOOD: Zustand for multi-step workflow
export const useOnboardingStore = create<OnboardingState>((set) => ({
  step: 1,
  email: '',
  orgName: '',
  nextStep: () => set(state => ({ step: state.step + 1 })),
  setEmail: (email) => set({ email }),
  // ...
}));
```

---

## 13. REVIEW CHECKLIST

When adding new state management, ask:

- [ ] Is this server data? → Use React Query
- [ ] Is this needed globally? → Use Context (memoize value!)
- [ ] Is this a complex workflow? → Use Zustand
- [ ] Is this component-scoped? → Use useState
- [ ] Are query keys using the centralized factory?
- [ ] Is orgId included in org-scoped queries?
- [ ] Are Context values memoized?
- [ ] Is staleTime appropriate for the data type?

---

## 14. REFERENCES

- **TanStack Query Docs:** https://tanstack.com/query/latest
- **React Context:** https://react.dev/reference/react/useContext
- **Zustand Docs:** https://zustand-demo.pmnd.rs/
- **Filla Query Keys:** `src/lib/queryKeys.ts` (to be created)

---

**Next Steps:**
1. Create centralized `queryKeys.ts` factory
2. Migrate remaining hooks to React Query
3. Document any new patterns as they emerge
