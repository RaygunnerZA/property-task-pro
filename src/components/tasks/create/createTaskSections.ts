/**
 * Shared section metadata for CreateTaskModal.
 * Defined here so both CreateTaskModal and CreateTaskSections can import it
 * without either depending on the other.
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
