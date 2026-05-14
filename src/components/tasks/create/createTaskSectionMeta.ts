/**
 * Shared section metadata for CreateTaskModal.
 * Kept in a separate file from CreateTaskSections.tsx so the modal and section
 * stack can share it without circular imports. Basename must not differ only
 * by letter case from CreateTaskSections.tsx (case-insensitive volume collision).
 */
import { User, Calendar, MapPin, AlertTriangle, Shield, Box, Tag } from "lucide-react";

export const CREATE_TASK_SECTIONS = [
  { id: "who", instruction: "Add Person or Team", valueLabel: "+Person", Icon: User },
  { id: "where", instruction: "Add Property or Space", valueLabel: "+Property", Icon: MapPin },
  { id: "when", instruction: "Add Due Date", valueLabel: "+Date", Icon: Calendar },
  { id: "what", instruction: "Add Asset", valueLabel: "+Asset", Icon: Box },
  { id: "priority", instruction: "Add Priority", valueLabel: "+Priority", Icon: AlertTriangle },
  { id: "category", instruction: "Add Tag", valueLabel: "+Tag", Icon: Tag },
  { id: "compliance", instruction: "Add Compliance Rule", valueLabel: "+Rule", Icon: Shield },
] as const;

export type CreateTaskSectionId = (typeof CREATE_TASK_SECTIONS)[number]["id"];
