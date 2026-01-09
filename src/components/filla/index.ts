/**
 * Filla Design System Components
 * 
 * DEPRECATION NOTICE:
 * The following components are deprecated and should be replaced:
 * - Surface → Use Card from @/components/ui/card or design system
 * - Typography (Heading, Text) → Use standard HTML elements with design system classes
 * - Button → Use NeomorphicButton from @/components/design-system/NeomorphicButton or shadcn Button
 * - Input → Use NeomorphicInput from @/components/design-system/NeomorphicInput or shadcn Input
 * - Badge → Use Badge from @/components/ui/badge with variants
 * 
 * Still in use (will be updated to use design tokens):
 * - SegmentControl / SegmentedControl
 * - MiniCalendar
 * - TaskCard
 * - DashboardTabs
 * 
 * Design tokens are now in tailwind.config.ts - use Tailwind classes instead.
 * See @Docs/04_UI_System.md for migration guide.
 */

// Still-used components
export * from './AIChip';
export * from './SegmentedControl';
export * from './SegmentControl';
export * from './FilterRow';
export * from './SectionHeader';

// Mini Calendar - DEPRECATED: Use DashboardCalendar from @/components/dashboard/DashboardCalendar instead
// export { MiniCalendar } from './MiniCalendar'; // DELETED
// export { MiniCalendarDayTile } from './MiniCalendarDayTile'; // DELETED
// export type { CalendarEvent, TaskEvent, ComplianceEvent, DayData } from './MiniCalendar'; // DELETED

// Cards & Tabs
export { TaskCard } from './TaskCard';
export type { TaskCardProps } from './TaskCard';
export { DashboardTabs } from './DashboardTabs';
export type { DashboardTabsProps, InboxItem, ReminderItem } from './DashboardTabs';

// Deprecated components (exported for backward compatibility during migration)
// TODO: Remove these once all usages are migrated
export * from './Surface';
export * from './Typography';
export * from './Button';
export * from './Input';
export * from './Badge';

// Design tokens (for backward compatibility - prefer tailwind.config.ts)
export { colors, neuShadows, typography, spacing, radii, shadows } from './tokens';
