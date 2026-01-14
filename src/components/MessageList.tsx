import { useMemo, useState, useEffect } from "react";
import { useMessages } from "../hooks/useMessages";
import { supabase } from "@/integrations/supabase/client";
import { FilterBar, type FilterOption, type FilterGroup } from "@/components/ui/filters/FilterBar";
import SkeletonTaskCard from "./SkeletonTaskCard";
import EmptyState from "./EmptyState";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { MessageSquare, User, CheckSquare, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface MessageListProps {
  onMessageClick?: (messageId: string) => void;
  selectedMessageId?: string;
}

export default function MessageList({ onMessageClick, selectedMessageId }: MessageListProps = {}) {
  const { messages, loading, error } = useMessages();
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [conversationTaskMap, setConversationTaskMap] = useState<Map<string, string>>(new Map()); // conversation_id -> task_id

  // Fetch conversation task mappings
  useEffect(() => {
    if (loading || error || messages.length === 0) {
      setConversationTaskMap(new Map());
      return;
    }

    const fetchConversationTasks = async () => {
      const conversationIds = [
        ...new Set(messages.map((m) => m.conversation_id).filter(Boolean)),
      ] as string[];
      if (conversationIds.length === 0) return;

      const { data } = await supabase
        .from("conversations")
        .select("id, task_id")
        .in("id", conversationIds);

      if (data) {
        const taskMap = new Map<string, string>();
        data.forEach((conv: Pick<Tables<"conversations">, "id" | "task_id">) => {
          if (conv.task_id) {
            taskMap.set(conv.id, conv.task_id);
          }
        });
        setConversationTaskMap(taskMap);
      }
    };

    fetchConversationTasks();
  }, [messages, loading, error]);

  // Get unique authors for filtering
  const authors = useMemo(() => {
    const authorSet = new Set<string>();
    messages.forEach((msg) => {
      if (msg.author_name) {
        authorSet.add(msg.author_name);
      }
    });
    return Array.from(authorSet).sort();
  }, [messages]);

  // Filter messages based on selected filters
  const filteredMessages = useMemo(() => {
    let filtered = [...messages];

    // Primary filters
    if (selectedFilters.has("filter-unread")) {
      // Assume messages without a read_at timestamp are unread
      filtered = filtered.filter((msg) => !("read_at" in msg) || !(msg as { read_at?: string | null }).read_at);
    }

    if (selectedFilters.has("filter-today")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((msg) => {
        const msgDate = new Date(msg.created_at);
        msgDate.setHours(0, 0, 0, 0);
        return msgDate.getTime() === today.getTime();
      });
    }

    // Secondary filters - Author
    const authorFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-author-"));
    if (authorFilterIds.length > 0) {
      const selectedAuthors = authorFilterIds.map(f => f.replace("filter-author-", ""));
      filtered = filtered.filter((msg) => {
        return msg.author_name && selectedAuthors.includes(msg.author_name);
      });
    }

    // Secondary filters - Has Task
    if (selectedFilters.has("filter-has-task")) {
      filtered = filtered.filter((msg) => {
        // Check if message's conversation is linked to a task
        return msg.conversation_id && conversationTaskMap.has(msg.conversation_id);
      });
    }

    return filtered;
  }, [messages, selectedFilters, conversationTaskMap]);

  // Filter options
  const primaryOptions: FilterOption[] = [
    {
      id: "filter-unread",
      label: "Unread",
      icon: <MessageSquare className="h-3 w-3" />,
    },
    {
      id: "filter-today",
      label: "Today",
      icon: <Clock className="h-3 w-3" />,
    },
  ];

  const secondaryGroups: FilterGroup[] = [
    {
      id: "author",
      label: "Author",
      options: authors.map((author) => ({
        id: `filter-author-${author}`,
        label: author,
        icon: <User className="h-3 w-3" />,
      })),
    },
    {
      id: "context",
      label: "Context",
      options: [
        {
          id: "filter-has-task",
          label: "Has Task",
          icon: <CheckSquare className="h-3 w-3" />,
        },
      ],
    },
  ];

  const handleFilterChange = (filterId: string, selected: boolean) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(filterId);
      } else {
        next.delete(filterId);
      }
      return next;
    });
  };

  if (loading)
    return (
      <div className="space-y-3">
        <SkeletonTaskCard />
        <SkeletonTaskCard />
      </div>
    );

  if (error) {
    return <EmptyState title="Unable to load messages" subtitle={error?.message || String(error)} />;
  }

  if (!messages.length)
    return <EmptyState title="No messages" subtitle="Messages from tasks and contractors appear here" />;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar
        primaryOptions={primaryOptions}
        secondaryGroups={secondaryGroups}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
      />

      {/* Messages List */}
      {filteredMessages.length === 0 ? (
        <EmptyState
          title="No messages match filters"
          subtitle="Try adjusting your filters"
        />
      ) : (
        <div className="space-y-3">
          {filteredMessages.map(msg => {
        const isSelected = selectedMessageId === msg.id;
        const truncatedBody = msg.body && msg.body.length > 150 
          ? msg.body.substring(0, 150) + '...' 
          : msg.body;

        return (
          <button
            key={msg.id}
            onClick={() => onMessageClick?.(msg.id)}
            className={cn(
              "w-full text-left p-4 rounded-[16px] backdrop-blur-md transition-all",
              "shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]",
              "hover:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
              "active:scale-[0.98]",
              isSelected 
                ? "bg-primary/10 border-2 border-primary shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]" 
                : "bg-white/60 border-2 border-transparent"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="text-xs font-medium text-muted-foreground">
                {msg.author_name || "Unknown"}
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {format(new Date(msg.created_at), "MMM d, h:mm a")}
              </div>
            </div>
            <div className="text-sm text-foreground line-clamp-3">
              {truncatedBody || "No message content"}
            </div>
          </button>
        );
      })}
        </div>
      )}
    </div>
  );
}
