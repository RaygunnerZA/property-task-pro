import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Surface, Heading, Text, Button } from '@/components/filla';
import { useTasks } from '@/hooks/useTasks';
import { useMessages } from '@/hooks/useMessages';
import { MessageSquare, Paperclip, Sparkles, AlertCircle, Clock } from 'lucide-react';

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
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <Heading variant="l" className="mb-4">Inbox</Heading>
        <Text variant="muted" className="mb-4">
          Triage activity and unprocessed items
        </Text>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'message' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('message')}
          >
            Messages
          </Button>
          <Button
            variant={filter === 'overdue' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('overdue')}
          >
            Overdue
          </Button>
          <Button
            variant={filter === 'ai_suggestion' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('ai_suggestion')}
          >
            AI
          </Button>
        </div>
      </div>

      {loading ? (
        <Surface variant="neomorphic" className="p-8 text-center">
          <p className="text-muted-foreground">Loading inbox...</p>
        </Surface>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const Icon = getIcon(item.type);
            return (
              <Surface
                key={item.id}
                variant="neomorphic"
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Text variant="body" className="font-medium">
                        {item.title}
                      </Text>
                      <Text variant="caption" className="text-muted-foreground whitespace-nowrap">
                        {item.timestamp.toLocaleDateString()}
                      </Text>
                    </div>
                    <Text variant="caption" className="text-muted-foreground line-clamp-2">
                      {item.description}
                    </Text>
                    {item.propertyName && (
                      <Text variant="caption" className="text-muted-foreground mt-1">
                        {item.propertyName}
                      </Text>
                    )}
                  </div>
                </div>
              </Surface>
            );
          })}
        </div>
      ) : (
        <Surface variant="neomorphic" className="p-8 text-center">
          <p className="text-muted-foreground">No inbox items</p>
        </Surface>
      )}
    </div>
  );
}
