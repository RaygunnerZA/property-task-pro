import { useMessages } from "../hooks/useMessages";
import EmptyState from "./EmptyState";

interface MessageListProps {
  orgId?: string;
}

export default function MessageList({ orgId }: MessageListProps) {
  const { messages, loading, error } = useMessages(orgId);

  if (loading) {
    return <EmptyState title="Loading messages..." />;
  }

  if (error) {
    return <EmptyState title="Error loading messages" subtitle={error} />;
  }

  if (messages.length === 0) {
    return <EmptyState title="No messages" subtitle="Messages will appear here" />;
  }

  return (
    <div className="space-y-3">
      {messages.map(message => (
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
                  {message.created_at ? new Date(message.created_at).toLocaleDateString() : ""}
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
