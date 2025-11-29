import { Surface, Heading, Text, Button } from '@/components/filla';
import { Loader2, Download, X } from 'lucide-react';
import { AuditExportProgress, AuditExportOutput } from '@/hooks/useAuditExport';

interface ExportProgressModalProps {
  type: string;
  progress: AuditExportProgress | null;
  output: AuditExportOutput | null;
  isExporting: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

export default function ExportProgressModal({ 
  type, 
  progress, 
  output,
  isExporting,
  onClose,
  onDownload
}: ExportProgressModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Surface variant="floating" className="w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <Heading variant="m">Exporting {type}</Heading>
            <Text variant="caption" className="text-neutral-600 mt-1">
              {isExporting ? 'Please wait...' : 'Export complete'}
            </Text>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-neutral-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {progress && (
          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Text variant="caption" className="text-neutral-700 font-medium">
                  {progress.step}
                </Text>
                <Text variant="caption" className="text-neutral-600">
                  {progress.progress}%
                </Text>
              </div>
              <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>

            {/* Progress Message */}
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              {isExporting && (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
              <Text variant="body">{progress.message}</Text>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {output && !isExporting ? (
            <>
              <Button 
                variant="primary" 
                className="flex-1 flex items-center justify-center gap-2"
                onClick={onDownload}
              >
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={onClose}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Close'}
            </Button>
          )}
        </div>
      </Surface>
    </div>
  );
}
