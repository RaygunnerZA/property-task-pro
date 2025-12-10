/**
 * Filla Design System Components
 * Export all components for easy importing
 */

export * from './tokens';
export * from './Surface';
export * from './Typography';
export * from './Button';
export * from './Input';
export * from './Badge';
export * from './AIChip';
export * from './SegmentedControl';
export * from './SegmentControl';
export * from './FilterRow';
export * from './SectionHeader';

// Mini Calendar
export { MiniCalendar } from './MiniCalendar';
export { MiniCalendarDayTile } from './MiniCalendarDayTile';
export type { CalendarEvent, TaskEvent, ComplianceEvent, DayData } from './MiniCalendar';

// Cards & Tabs
export { TaskCard } from './TaskCard';
export type { TaskCardProps } from './TaskCard';
export { DashboardTabs } from './DashboardTabs';
export type { DashboardTabsProps, InboxItem, ReminderItem } from './DashboardTabs';

// Design system exports (includes some duplicates but with additional features)
export { 
  colors, 
  shadows, 
  typography, 
  spacing, 
  radii, 
  motion,
  DesignSystemPreview 
} from './DesignSystem';
