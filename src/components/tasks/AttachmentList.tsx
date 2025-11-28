import React from 'react';
import { Surface, Text, Button } from '@/components/filla';
import { Paperclip, Download, FileText, Image as ImageIcon, File } from 'lucide-react';

interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  createdAt: Date;
}

interface AttachmentListProps {
  attachments: Attachment[];
  onAdd?: () => void;
  onDownload?: (attachment: Attachment) => void;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return ImageIcon;
  if (fileType.includes('pdf')) return FileText;
  return File;
};

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  onAdd,
  onDownload
}) => {
  return (
    <Surface variant="neomorphic" className="p-4 border-t border-white/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-muted-foreground" />
          <Text variant="label">Attachments</Text>
          <span className="text-xs text-muted-foreground">({attachments.length})</span>
        </div>
        {onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            Add
          </Button>
        )}
      </div>

      {attachments.length === 0 ? (
        <Text variant="caption" className="text-center py-4">
          No attachments
        </Text>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.fileType);
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
              >
                <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Text variant="body" className="truncate text-sm">
                    {attachment.fileName}
                  </Text>
                </div>
                {onDownload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDownload(attachment)}
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
};
