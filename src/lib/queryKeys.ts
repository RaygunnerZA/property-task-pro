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
  taskDetails: (orgId?: string, taskId?: string) =>
    ['taskDetails', orgId, taskId] as const,
  taskAttachments: (taskId?: string) => ['taskAttachments', taskId] as const,
  
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
  subscription: (orgId?: string) => ['subscription', orgId] as const,
  dashboardMetrics: (orgId?: string) => ['dashboardMetrics', orgId] as const,

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
  schedule: (orgId?: string, startDate?: string, endDate?: string, filterKey?: string) =>
    ['schedule', orgId, startDate, endDate, filterKey] as const,

  // Checklist Templates
  checklistTemplates: (orgId?: string) => ['checklistTemplates', orgId] as const,
  checklistTemplateItems: (templateId?: string) => ['checklistTemplateItems', templateId] as const,
  checklistTemplateWithItems: (orgId?: string, templateId?: string) =>
    ['checklistTemplateWithItems', orgId, templateId] as const,

  // Task Categories (task_themes junction table)
  taskCategories: (taskId?: string) => ['taskCategories', taskId] as const,
  
  // Task Categories (alternative key used in use-task-details)
  taskCategoriesLegacy: (taskId?: string) => ['task-categories', taskId] as const,

  // Initial Org Data (combined query for org, member, hasProperties, hasSpaces)
  initialOrgData: (orgId?: string) => ['initialOrgData', orgId] as const,

  // Groups
  groups: (orgId?: string) => ['groups', orgId] as const,
  groupMembers: (orgId?: string, groupId?: string) => ['groupMembers', orgId, groupId] as const,
  taskGroups: (taskId?: string) => ['taskGroups', taskId] as const,

  // Property Details & Related
  propertyDetails: (orgId?: string, propertyId?: string) => ['propertyDetails', orgId, propertyId] as const,
  propertyUtilities: (orgId?: string, propertyId?: string) => ['propertyUtilities', orgId, propertyId] as const,
  propertyLegal: (orgId?: string, propertyId?: string) => ['propertyLegal', orgId, propertyId] as const,
  propertyThemes: (orgId?: string, propertyId?: string) => ['propertyThemes', orgId, propertyId] as const,
  propertyTasks: (orgId?: string, propertyId?: string) => ['propertyTasks', orgId, propertyId] as const,

  // Task Timeline & Activity
  taskTimeline: (taskId?: string) => ['taskTimeline', taskId] as const,
  recentActivity: (orgId?: string) => ['recentActivity', orgId] as const,

  // Image Annotations
  imageAnnotations: (taskId?: string, imageId?: string) => ['imageAnnotations', taskId, imageId] as const,

  // Compliance
  rulesCompliance: (orgId?: string) => ['rulesCompliance', orgId] as const,
  ruleStatusDistribution: (orgId?: string) => ['ruleStatusDistribution', orgId] as const,
  pendingReviews: (orgId?: string) => ['pendingReviews', orgId] as const,
  propertyDriftHeatmap: (orgId?: string) => ['propertyDriftHeatmap', orgId] as const,
  complianceTasks: (orgId?: string) => ['complianceTasks', orgId] as const,
  batchRewrite: (reviewId?: string) => ['batchRewrite', reviewId] as const,

  // Vendor
  vendorTasks: () => ['vendorTasks'] as const,
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