export type SuggestionKind =
  | "certificate_expiry"
  | "waiting_access"
  | "duplicate_report"
  | "missing_certificate"
  | "repeated_fault"
  | "tenant_notification"
  | "off_site_completion"
  | "external_email";

export type SuggestionActionKind =
  | "open_task"
  | "open_record"
  | "open_asset"
  | "open_signal"
  | "open_intake";

export type SuggestionAction = {
  kind: SuggestionActionKind;
  label: string;
  taskId?: string;
  recordId?: string;
  assetId?: string;
  signalId?: string;
  propertyId?: string | null;
  intakeMode?: "report_issue" | "add_record";
};

export type SuggestionEvidence = {
  id: string;
  label: string;
  kind: "task" | "record" | "signal" | "asset" | "message" | "event";
  action: SuggestionAction;
};

export type SuggestionPerson = {
  id: string;
  name: string;
  role?: string | null;
};

export type ActionableSuggestion = {
  id: string;
  kind: SuggestionKind;
  headline: string;
  message: string;
  action: SuggestionAction;
  evidence: SuggestionEvidence[];
  propertyId: string | null;
  propertyName?: string | null;
  assetId?: string | null;
  assetName?: string | null;
  taskId?: string | null;
  people: SuggestionPerson[];
  signalIds: string[];
  confidence: "observed" | "qualified";
  priority: number;
  responsibleUserId?: string | null;
};

export type SuggestionTask = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  assigned_user_id?: string | null;
  assigned_vendor_name?: string | null;
  due_date?: string | null;
  due_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  is_compliance?: boolean | null;
  type?: string | null;
  images?: unknown;
  asset_ids?: string[] | null;
};

export type SuggestionDocument = {
  id: string;
  title?: string | null;
  document_type?: string | null;
  expiry_date?: string | null;
  next_due_date?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  linked_asset_ids?: string[] | null;
  expiry_state?: string | null;
  notes?: string | null;
  description?: string | null;
};

export type SuggestionAsset = {
  id: string;
  name: string;
  property_id?: string | null;
};

export type SuggestionTaskAssetLink = {
  taskId: string;
  assetId: string;
};

export type SuggestionMessage = {
  taskId: string;
  body: string;
  createdAt: string;
  direction?: string | null;
  source?: string | null;
};

export type SuggestionUserState = {
  dismissedAt?: string;
  snoozedUntil?: string;
  fingerprint?: string;
};

export type SuggestionCompileContext = {
  now: Date;
  currentUserId: string | null;
  role: string | null;
  assignedPropertyIds: string[] | null;
  scopedPropertyIds?: Set<string>;
  tasks: SuggestionTask[];
  documents: SuggestionDocument[];
  signals: Array<{
    id: string;
    property_id?: string | null;
    asset_id?: string | null;
    space_id?: string | null;
    kind: string;
    subtype: string;
    severity: string;
    title: string;
    body?: string | null;
    disposition: string;
    payload?: Record<string, unknown>;
    recommendation?: Record<string, unknown> | null;
    created_at: string;
    expires_at?: string | null;
    resolved_at?: string | null;
    converted_entity_type?: string | null;
    converted_entity_id?: string | null;
  }>;
  taskAssetLinks: SuggestionTaskAssetLink[];
  assets: SuggestionAsset[];
  messagesByTaskId: Record<string, SuggestionMessage[]>;
  membersByUserId: Record<string, { name: string; role?: string | null }>;
  userState: Record<string, SuggestionUserState>;
};

export const SUPPORTED_SUGGESTION_KINDS: Record<
  SuggestionKind,
  { supported: boolean; needs?: string }
> = {
  certificate_expiry: { supported: true },
  waiting_access: { supported: true },
  duplicate_report: { supported: true },
  missing_certificate: { supported: true },
  repeated_fault: { supported: true },
  tenant_notification: {
    supported: true,
    needs: "Visit tasks plus task messages. There is no dedicated tenant-notification entity.",
  },
  off_site_completion: { supported: true },
  external_email: { supported: true },
};
