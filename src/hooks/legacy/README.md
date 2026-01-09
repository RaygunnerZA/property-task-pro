# Legacy Hooks

⚠️ **DEPRECATED** - These hooks are kept for backward compatibility only.

## Migration Status

All deprecated hooks have been moved to this folder. They should **NOT** be used in new code.

### Deprecated Hooks

- `useTasks.ts` - Use `useTasksQuery()` from `@/hooks/useTasksQuery` instead
- `useProperties.ts` - Use `usePropertiesQuery()` from `@/hooks/usePropertiesQuery` instead
- `use-assets.ts` - Use `useAssetsQuery()` from `@/hooks/useAssetsQuery` instead
- `use-compliance.ts` - Use `useComplianceQuery()` from `@/hooks/useComplianceQuery` instead
- `use-tasks.ts` - Use `useTasksQuery()` from `@/hooks/useTasksQuery` instead

## Why These Are Deprecated

1. **Performance**: Legacy hooks use sequential queries (6+ database calls) vs optimized views (1 call)
2. **Caching**: Legacy hooks don't use React Query caching
3. **Data Completeness**: Optimized views include aggregated data (spaces, themes, teams, property info)

## Migration Guide

See the JSDoc comments in each hook file for migration examples.

## Removal Plan

These hooks will be removed in a future version after confirming no edge cases remain.

