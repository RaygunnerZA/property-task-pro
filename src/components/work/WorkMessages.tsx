import { colors, shadows } from '@/components/filla';
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
        <button
          key={message.id}
          className="w-full text-left rounded-lg p-4 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          style={{
            backgroundColor: colors.surface,
            boxShadow: shadows.outset
          }}
        >
          <div className="flex items-start gap-3">
            <div 
              className="p-2 rounded-full shrink-0"
              style={{
                backgroundColor: `${colors.primary}1a`,
              }}
            >
              <User className="h-4 w-4" style={{ color: colors.primary }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span 
                  className="text-base font-semibold truncate"
                  style={{ color: colors.ink }}
                >
                  {message.from}
                </span>
                <span 
                  className="text-xs shrink-0"
                  style={{ color: colors.textLight }}
                >
                  {message.time}
                </span>
              </div>
              <p 
                className="text-sm font-medium mb-0.5 truncate"
                style={{ color: colors.ink }}
              >
                {message.subject}
              </p>
              <p 
                className="text-xs truncate"
                style={{ color: colors.textMuted }}
              >
                {message.preview}
              </p>
            </div>
            {message.unread && (
              <div 
                className="w-2 h-2 rounded-full shrink-0 mt-2"
                style={{ backgroundColor: colors.primary }}
              />
            )}
          </div>
        </button>
      ))}

      {messages.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare 
            className="h-12 w-12 mx-auto mb-3 opacity-50"
            style={{ color: colors.textMuted }}
          />
          <p style={{ color: colors.textMuted }}>
            No messages yet
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkMessages;
