import { useAuth } from "../hooks/useAuth";
import { useMessages } from "../hooks/useMessages";
import PageSection from "./PageSection";
import { SectionTitle } from "../design-system/DesignSystem";

export default function MessageList() {
  const { session } = useAuth();
  const orgId = session?.user?.user_metadata?.org_id || "";
  const { messages, loading, error } = useMessages(orgId);

  if (loading) {
    return (
      <PageSection>
        <p className="text-[#6F6F6F] text-sm">Loading messages...</p>
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection>
        <p className="text-red-600 text-sm">Error loading messages</p>
      </PageSection>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <PageSection>
        <SectionTitle>Messages</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">No messages yet.</p>
      </PageSection>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className="p-4 bg-white/60 backdrop-blur-md rounded-[12px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0E8388]/20 flex items-center justify-center text-[13px]">
              {message.author_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[13px] font-semibold text-[#1A1A1A]">
                  {message.author_name || "Unknown"}
                </span>
                <span className="text-[11px] text-[#6F6F6F]">
                  {new Date(message.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[13px] text-[#6F6F6F]">{message.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
