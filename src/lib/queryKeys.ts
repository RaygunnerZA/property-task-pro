/**
 * Centralized Query Key Factory
 * 
 * All TanStack Query keys should be defined here to ensure:
 * - Consistent naming patterns
 * - Easy invalidation
 * - Type safety
 * - Discoverability
 * 
 * Pattern: [entity, ...scopes, ...identifiers]
 * - entity: The main entity type (e.g., 'tasks', 'messages')
 * - scopes: Org/user scoping (e.g., orgId, userId)
 * - identifiers: Specific resource identifiers (e.g., taskId, messageId)
 */

export const queryKeys = {
  // Auth & Identity
  activeOrg: (userId?: string) => ['activeOrg', userId] as const,
  authUser: () => ['auth', 'user'] as const,

  // Tasks
  tasks: (orgId?: string) => ['tasks', orgId] as const,
  task: (orgId?: string, taskId?: string) => ['tasks', orgId, taskId] as const,
  
  // Messages & Conversations
  taskMessages: (orgId?: string, taskId?: string) => 
    ['taskMessages', orgId, taskId] as const,
  conversation: (orgId?: string, conversationId?: string) =>
    ['conversations', orgId, conversationId] as const,
  messages: (orgId?: string, conversationId?: string) =>
    ['messages', orgId, conversationId] as const,
  allMessages: (orgId?: string) =>
    ['messages', orgId] as const, // All messages for an org

  // Properties
  properties: (orgId?: string) => ['properties', orgId] as const,
  property: (orgId?: string, propertyId?: string) =>
    ['properties', orgId, propertyId] as const,

  // Spaces
  spaces: (orgId?: string, propertyId?: string) =>
    ['spaces', orgId, propertyId] as const,

  // Organisation & Members
  organisation: (orgId?: string) => ['organisation', orgId] as const,
  orgMembers: (orgId?: string) => ['orgMembers', orgId] as const,
  teams: (orgId?: string) => ['teams', orgId] as const,

  // Categories & Themes
  categories: (orgId?: string) => ['categories', orgId] as const,
  themes: (orgId?: string, type?: string) => ['themes', orgId, type] as const,

  // Assets
  assets: (orgId?: string, propertyId?: string, spaceId?: string) =>
    ['assets', orgId, propertyId, spaceId] as const,

  // Subtasks
  subtasks: (orgId?: string, taskId?: string) =>
    ['subtasks', orgId, taskId] as const,

  // Reminders/Signals
  reminders: (orgId?: string) => ['reminders', orgId] as const,

  // AI Extractions
  aiExtractions: (orgId?: string, taskId?: string) =>
    ['aiExtractions', orgId, taskId] as const,
  latestAIExtraction: (orgId?: string, taskId?: string) =>
    ['aiExtractions', orgId, taskId, 'latest'] as const,
  aiModels: () => ['aiModels'] as const,

  // Labels
  labels: (orgId?: string) => ['labels', orgId] as const,
  taskLabels: (taskId?: string) => ['taskLabels', taskId] as const,

  // Schedule
  schedule: (orgId?: string, startDate?: string, endDate?: string) =>
    ['schedule', orgId, startDate, endDate] as const,

  // Checklist Templates
  checklistTemplates: (orgId?: string) => ['checklistTemplates', orgId] as const,
} as const;

/**
 * Helper to invalidate all queries for an entity
 * 
 * @example
 * // Invalidate all task queries for an org
 * queryClient.invalidateQueries({ queryKey: queryKeys.tasks(orgId) });
 * 
 * // Invalidate a specific task
 * queryClient.invalidateQueries({ queryKey: queryKeys.task(orgId, taskId) });
 */