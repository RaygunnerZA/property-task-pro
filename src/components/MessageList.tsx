import { useMessages } from "../hooks/useMessages";
import SkeletonTaskCard from "./SkeletonTaskCard";
import EmptyState from "./EmptyState";

export default function MessageList({ orgId }: { orgId?: string }) {
  const { messages, loading, error } = useMessages(orgId);

  if (loading) return (
    <div className="space-y-3">
      <SkeletonTaskCard />
      <SkeletonTaskCard />
    </div>
  );

  if (error) return <EmptyState title="Unable to load messages" subtitle={error} />;

  if (!messages.length) return (
    <EmptyState title="No messages" subtitle="Messages from tasks and contractors appear here" />
  );

  return (
    <div className="space-y-3">
      {messages.map(msg => (
        <div key={msg.id} className="p-4 bg-white/60 rounded-[16px] backdrop-blur-md shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]">
          <div className="text-xs text-[#6F6F6F] mb-1">{msg.author_name}</div>
          <div className="text-sm">{msg.body}</div>
        </div>
      ))}
    </div>
  );
}
