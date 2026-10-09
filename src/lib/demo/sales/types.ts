export type SalesTaskStatus = "open" | "in_progress" | "waiting_review" | "completed" | "archived";
export type SalesTaskPriority = "low" | "medium" | "high" | "urgent";

export type SalesUser = {
  key: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type SalesMember = {
  userKey: string;
  role: "owner" | "manager" | "staff";
  is_primary_owner: boolean;
  assigned_property_keys: string[] | null;
};

export type SalesSpace = { key: string; name: string; icon_name: string };
export type SalesAsset = {
  key: string;
  name: string;
  spaceKey: string;
  group: string;
  asset_type: string;
  category: string;
  condition_score: number;
  status: string;
  icon_name: string;
  notes: string;
  warranty_offset_days?: number;
};

export type SalesContact = {
  key: string;
  name: string;
  email: string;
  phone: string;
  role_label: string;
  kind: "contact" | "contractor" | "supplier" | "agent" | "other";
  propertyKey?: string;
  notes: string;
};

export type SalesTask = {
  key: string;
  title: string;
  description: string;
  status: SalesTaskStatus;
  priority: SalesTaskPriority;
  type: string;
  is_compliance: boolean;
  due_offset_days?: number;
  created_offset_days: number;
  completed_offset_days?: number;
  updated_offset_days: number;
  assigned_user_key?: string;
  contractor_key?: string;
  space_keys: string[];
  asset_keys: string[];
  recurrence?: { type: "weekly" | "monthly" | "yearly"; interval: number };
};

export type SalesMessage = {
  author_name: string;
  author_role: string;
  author_user_key?: string;
  direction: "inbound" | "outbound";
  source: string;
  body: string;
  created_offset_hours: number;
};

export type SalesConversation = {
  key: string;
  taskKey: string;
  channel: string;
  subject: string;
  messages: SalesMessage[];
};

export type SalesRecord = {
  key: string;
  fileKey: string;
  title: string;
  file_name: string;
  category: string;
  document_type: string;
  notes: string;
  issuer: string;
  reference: string;
  parent: "property" | "task";
  taskKey?: string;
  spaceKey?: string;
  assetKey?: string;
  expiry_offset_days?: number;
  created_offset_days: number;
};

export type SalesCompliance = {
  key: string;
  title: string;
  document_type: string;
  notes: string;
  expiry_offset_days: number;
  linked_asset_keys: string[];
  created_offset_days: number;
};

export type SalesSignal = {
  key: string;
  propertyKey: string;
  title: string;
  body: string;
  theme: "safety" | "maintenance" | "compliance" | "seasonal" | "efficiency" | "opportunity" | "monitoring";
  state: "open" | "snoozed" | "resolved" | "dismissed";
  severity: "info" | "warning" | "urgent";
  disposition: "recent" | "needs_review" | "urgent" | "dismissed";
  created_offset_days: number;
};

export type SalesActivity = {
  key: string;
  action: string;
  entity_type: string;
  taskKey?: string;
  summary: string;
  created_offset_days: number;
};

export type SalesFile = {
  key: string;
  file_name: string;
  mime: string;
  kind: "record" | "leak";
  caption?: string;
  eyebrow?: string;
  title?: string;
  issuer?: string;
  reference?: string;
  dateLabel?: string;
  lines?: string[];
};

export type SalesProperty = {
  key: string;
  address: string;
  nickname: string;
  icon_name: string;
  icon_color_hex: string;
  owner_name: string;
  owner_email: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  details: { site_type: string; ownership_type: string; floor_count: number };
  spaces: SalesSpace[];
  assets: SalesAsset[];
  contacts: SalesContact[];
  tasks: SalesTask[];
  records: SalesRecord[];
  compliance_documents: SalesCompliance[];
  conversations: SalesConversation[];
  signals: SalesSignal[];
  activity: SalesActivity[];
};

export type SalesOrg = {
  key: string;
  name: string;
  slug: string;
  org_type: "personal" | "business";
  plan_id: string;
  members: SalesMember[];
  properties: SalesProperty[];
};

export type SalesDataset = {
  timeZone: "Europe/London";
  users: SalesUser[];
  files: SalesFile[];
  orgs: SalesOrg[];
};

export const DOCUMENT_CATEGORIES = [
  "Plans",
  "Legal",
  "Fire Safety",
  "Electrical",
  "Mechanical",
  "Water",
  "Insurance",
  "Contractors",
  "Warranties",
  "O&M Manuals",
  "Misc",
] as const;
