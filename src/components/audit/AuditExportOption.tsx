import { useState } from 'react';
import { Surface, Heading, Text, Button } from '@/components/filla';
import { FileDown, LucideIcon } from 'lucide-react';
import ExportProgressModal from './ExportProgressModal';
import { useAuditExport } from '@/hooks/useAuditExport';

interface AuditExportOptionProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  exportType?: string;
}

export default function AuditExportOption({ 
  title, 
  description, 
  icon: Icon,
  exportType 
}: AuditExportOptionProps) {
  const [showModal, setShowModal] = useState(false);
  const { progress, output, isExporting, startExport, cancelExport } = useAuditExport();

  const handleExport = async () => {
    setShowModal(true);
    await startExport(exportType ?? title);
  };

  const handleClose = () => {
    cancelExport();
    setShowModal(false);
  };

  const handleDownload = () => {
    if (output?.url) {
      // Placeholder - would trigger actual download
      console.log('Downloading:', output.filename);
    }
  };

  return (
    <>
      <Surface variant="neomorphic" className="p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-white/60" />
        
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="p-3 rounded-lg bg-primary/10 shrink-0">
              <Icon className="w-6 h-6 text-primary" />
            </div>
          )}
          
          <div className="flex-1 space-y-3">
            <div>
              <Heading variant="m">{title}</Heading>
              <Text variant="body" className="text-neutral-600 mt-1">
                {description}
              </Text>
            </div>

            <Button 
              variant="primary" 
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </Surface>

      {showModal && (
        <ExportProgressModal
          type={title}
          progress={progress}
          output={output}
          isExporting={isExporting}
          onClose={handleClose}
          onDownload={handleDownload}
        />
      )}
    </>
  );
}
