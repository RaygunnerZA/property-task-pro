import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Users, Activity, Cpu } from "lucide-react";
import { useAdminOrg, AdminAuditEntry } from "@/hooks/admin/useAdminOrg";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  "ai.doc.analysed": "Document analysed by AI",
  "ai.extract.completed": "AI task extraction completed",
  "ai.image.analysed": "Image analysed by AI",
  "assistant.action.executed": "Assistant action executed",
  "compliance.scheduled": "Compliance item scheduled",
};

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-primary/15 text-primary",
    member: "bg-muted text-muted-foreground",
    vendor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-mono uppercase tracking-wide",
        styles[role] ?? "bg-muted text-muted-foreground"
      )}
    >
      {role}
    </span>
  );
}

function ActivityEntry({
  entry,
  emailByUserId,
}: {
  entry: AdminAuditEntry;
  emailByUserId: Map<string, string>;
}) {
  const label = ACTION_LABELS[entry.action];
  const actorEmail = entry.actor_id ? emailByUserId.get(entry.actor_id) : null;
  const shortEntity = entry.entity_id
    ? `${entry.entity_type} · ${entry.entity_id.slice(0, 8)}…`
    : entry.entity_type;

  return (
    <div className="flex gap-3 py-2.5">
      <div className="w-1.5 h-1.5 rounded-full bg-border mt-2 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          {label ?? (
            <span className="font-mono text-xs text-muted-foreground">{entry.action}</span>
          )}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {shortEntity && (
            <span className="text-xs text-muted-foreground font-mono">{shortEntity}</span>
          )}
          {actorEmail && (
            <span className="text-xs text-muted-foreground">{actorEmail}</span>
          )}
          <span className="text-xs text-muted-foreground/60">
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrgDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { org, members, activity, isLoading, error } = useAdminOrg(orgId ?? "");

  const emailByUserId = new Map(members.map((m) => [m.user_id, m.email]));

  if (error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-[8px] px-4 py-3">
        Failed to load organisation.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back nav */}
      <button
        onClick={() => navigate("/admin/orgs")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Organisations
      </button>

      {/* Org header */}
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-[12px] bg-muted" />
      ) : org ? (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">{org.org_name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{org.org_type}</span>
              <span>·</span>
              <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
              <span>·</span>
              <span>{members.length} member{members.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <Link
            to={`/admin/orgs/${orgId}/ai`}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Cpu className="w-4 h-4" />
            View AI Requests
          </Link>
        </div>
      ) : null}

      {/* Members */}
      <section>
        <h2 className="flex items-center gap-2 text-base font-medium mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          Members
        </h2>
        <div className="rounded-[12px] border border-border overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/40">
              <tr>
                {["Email", "Role", "Joined", "Last sign in"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No members.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.user_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{m.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={m.role} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {m.last_sign_in_at
                        ? formatDistanceToNow(new Date(m.last_sign_in_at), { addSuffix: true })
                        : "Never"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="flex items-center gap-2 text-base font-medium mb-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
          Recent Activity
        </h2>
        <div className="rounded-[12px] border border-border px-4 py-2 shadow-sm">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No activity recorded yet.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {activity.map((entry) => (
                <ActivityEntry key={entry.id} entry={entry} emailByUserId={emailByUserId} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
