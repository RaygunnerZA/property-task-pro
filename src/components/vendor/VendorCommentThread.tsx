import React from 'react';
import { Surface, Text } from '@/components/filla';
import { MessageCircle } from 'lucide-react';

interface Comment {
  author: string;
  message: string;
  timestamp?: string;
}

interface VendorCommentThreadProps {
  comments?: Comment[];
}

export const VendorCommentThread: React.FC<VendorCommentThreadProps> = ({ comments = [] }) => {
  if (comments.length === 0) {
    return (
      <Surface variant="neomorphic" className="p-6 text-center">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
        <Text variant="caption">No comments yet</Text>
      </Surface>
    );
  }

  return (
    <Surface variant="neomorphic" className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        <Text variant="label">Comments</Text>
      </div>

      <div className="space-y-3">
        {comments.map((comment, i) => (
          <div key={i} className="bg-background/30 rounded-lg p-3 space-y-1">
            <Text variant="label" className="text-sm">{comment.author}</Text>
            <Text variant="body" className="text-sm">{comment.message}</Text>
            {comment.timestamp && (
              <Text variant="caption">{comment.timestamp}</Text>
            )}
          </div>
        ))}
      </div>
    </Surface>
  );
};
