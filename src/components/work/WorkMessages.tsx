import { Surface, Text, Heading } from '@/components/filla';
import { MessageSquare, User } from 'lucide-react';

const WorkMessages = () => {
  const messages = [
    {
      id: '1',
      from: 'John Smith',
      subject: 'Re: HVAC Maintenance',
      preview: 'Thanks for the update. When can we schedule...',
      time: '2 hours ago',
      unread: true,
    },
    {
      id: '2',
      from: 'Sarah Johnson',
      subject: 'Fire Safety Inspection',
      preview: 'Inspection completed. Report attached.',
      time: '1 day ago',
      unread: false,
    },
    {
      id: '3',
      from: 'Mike Williams',
      subject: 'Property 123 - Update',
      preview: 'All tasks completed for this property.',
      time: '2 days ago',
      unread: false,
    },
  ];

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <Surface
          key={message.id}
          variant="neomorphic"
          interactive
          className="p-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <Heading variant="m" className="truncate">
                  {message.from}
                </Heading>
                <Text variant="caption" className="text-muted-foreground shrink-0">
                  {message.time}
                </Text>
              </div>
              <Text variant="body" className="font-medium mb-1 truncate">
                {message.subject}
              </Text>
              <Text variant="caption" className="text-muted-foreground truncate">
                {message.preview}
              </Text>
            </div>
            {message.unread && (
              <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
            )}
          </div>
        </Surface>
      ))}

      {messages.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <Text variant="body" className="text-muted-foreground">
            No messages yet
          </Text>
        </div>
      )}
    </div>
  );
};

export default WorkMessages;
