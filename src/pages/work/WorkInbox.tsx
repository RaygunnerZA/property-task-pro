import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { useMessages } from '@/hooks/useMessages';
import { MessageSquare, Paperclip, Sparkles, AlertCircle, Clock, Inbox } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NeomorphicButton } from '@/components/design-system/NeomorphicButton';
import { cn } from '@/lib/utils';

type InboxItemType = 'message' | 'attachment' | 'ai_suggestion' | 'overdue' | 'task_event';

interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  description: string;
  timestamp: Date;
  taskId?: string;
  propertyName?: string;
}

export default function WorkInbox() {
  const navigate = useNavigate();
  const { tasks, loading: tasksLoading } = useTasks();
  const { messages, loading: messagesLoading } = useMessages();
  const [filter, setFilter] = useState<'all' | InboxItemType>('all');

  // Combine different data sources into inbox items
  const inboxItems: InboxItem[] = [];

  // Add messages as inbox items
  if (messages) {
    messages.forEach(msg => {
      inboxItems.push({
        id: msg.id,
        type: 'message',
        title: 'New message',
        description: msg.body || msg.author_name,
        timestamp: new Date(msg.created_at),
      });
    });
  }

  // Add overdue tasks as inbox items
  if (tasks) {
    const now = new Date();
    tasks
      .filter(task => task.due_at && new Date(task.due_at) < now && task.status !== 'completed')
      .forEach(task => {
        inboxItems.push({
          id: task.id,
          type: 'overdue',
          title: 'Overdue task',
          description: task.title,
          timestamp: new Date(task.due_at),
          taskId: task.id,
        });
      });
  }

  // Sort by timestamp, newest first
  inboxItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Filter items
  const filteredItems = filter === 'all' 
    ? inboxItems 
    : inboxItems.filter(item => item.type === filter);

  const getIcon = (type: InboxItemType) => {
    switch (type) {
      case 'message': return MessageSquare;
      case 'attachment': return Paperclip;
      case 'ai_suggestion': return Sparkles;
      case 'overdue': return AlertCircle;
      case 'task_event': return Clock;
    }
  };

  const handleItemClick = (item: InboxItem) => {
    if (item.taskId) {
      navigate(`/task/${item.taskId}`);
    }
  };

  const loading = tasksLoading || messagesLoading;

  return (
    <StandardPage
      title="Inbox"
      subtitle="Triage activity and unprocessed items"
      icon={<Inbox className="h-6 w-6" />}
      maxWidth="lg"
    >
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          <NeomorphicButton
            size="sm"
            onClick={() => setFilter('all')}
            className={cn(filter === 'all' && 'bg-primary text-primary-foreground')}
          >
            All
          </NeomorphicButton>
          <NeomorphicButton
            size="sm"
            onClick={() => setFilter('message')}
            className={cn(filter === 'message' && 'bg-primary text-primary-foreground')}
          >
            Messages
          </NeomorphicButton>
          <NeomorphicButton
            size="sm"
            onClick={() => setFilter('overdue')}
            className={cn(filter === 'overdue' && 'bg-primary text-primary-foreground')}
          >
            Overdue
          </NeomorphicButton>
          <NeomorphicButton
            size="sm"
            onClick={() => setFilter('ai_suggestion')}
            className={cn(filter === 'ai_suggestion' && 'bg-primary text-primary-foreground')}
          >
            AI
          </NeomorphicButton>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading inbox..." />
      ) : filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const Icon = getIcon(item.type);
            return (
              <Card
                key={item.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer shadow-e1"
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-base font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {item.timestamp.toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                    {item.propertyName && (
                      <Badge variant="outline" className="mt-2">
                        {item.propertyName}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Inbox}
          title="No inbox items"
          description="Your inbox is empty"
        />
      )}
    </StandardPage>
  );
}
