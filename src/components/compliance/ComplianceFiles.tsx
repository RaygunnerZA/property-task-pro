import { useMemo } from "react";
import { Files, FolderItem, FolderTrigger, FolderContent, SubFiles, FileItem } from "@/components/ui/files";
import { FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ExternalLink } from "lucide-react";

interface ComplianceDocument {
  id: string;
  title?: string;
  expiry_date?: string;
  expiry_status?: "expired" | "expiring" | "valid" | "none";
  days_until_expiry?: number | null;
  status?: string;
  file_url?: string;
}

interface ComplianceFilesProps {
  documents: ComplianceDocument[];
  onDocumentClick?: (document: ComplianceDocument) => void;
}

export function ComplianceFiles({ documents, onDocumentClick }: ComplianceFilesProps) {
  const groupedDocuments = useMemo(() => {
    const expired: ComplianceDocument[] = [];
    const expiring: ComplianceDocument[] = [];
    const valid: ComplianceDocument[] = [];
    const none: ComplianceDocument[] = [];

    documents.forEach((doc) => {
      const status = doc.expiry_status || "none";
      if (status === "expired") {
        expired.push(doc);
      } else if (status === "expiring") {
        expiring.push(doc);
      } else if (status === "valid") {
        valid.push(doc);
      } else {
        none.push(doc);
      }
    });

    return { expired, expiring, valid, none };
  }, [documents]);

  const handleFileClick = (doc: ComplianceDocument) => {
    if (doc.file_url) {
      if (onDocumentClick) {
        onDocumentClick(doc);
      } else {
        window.open(doc.file_url, "_blank");
      }
    }
  };

  const getFileIcon = () => FileText;
  const getStatusIcon = (status: string) => {
    if (status === "expired") return AlertTriangle;
    if (status === "valid") return CheckCircle2;
    return FileText;
  };

  const formatExpiryDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return format(parseISO(dateString), "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <Files type="multiple" defaultValue={["expired", "expiring"]} className="w-full">
      {groupedDocuments.expired.length > 0 && (
        <FolderItem value="expired">
          <FolderTrigger gitStatus="deleted">
            Expired ({groupedDocuments.expired.length})
          </FolderTrigger>
          <FolderContent>
            <SubFiles>
              {groupedDocuments.expired.map((doc) => (
                <FileItem
                  key={doc.id}
                  icon={getStatusIcon("expired")}
                  gitStatus="deleted"
                  onClick={() => handleFileClick(doc)}
                  className="text-destructive/80 hover:text-destructive"
                >
                  <span className="flex-1">
                    {doc.title || "Untitled Document"}
                    {doc.expiry_date && (
                      <span className="text-xs ml-2 opacity-70">
                        ({formatExpiryDate(doc.expiry_date)})
                      </span>
                    )}
                  </span>
                  {doc.file_url && (
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  )}
                </FileItem>
              ))}
            </SubFiles>
          </FolderContent>
        </FolderItem>
      )}

      {groupedDocuments.expiring.length > 0 && (
        <FolderItem value="expiring">
          <FolderTrigger gitStatus="modified">
            Expiring Soon ({groupedDocuments.expiring.length})
          </FolderTrigger>
          <FolderContent>
            <SubFiles>
              {groupedDocuments.expiring.map((doc) => (
                <FileItem
                  key={doc.id}
                  icon={getStatusIcon("expiring")}
                  gitStatus="modified"
                  onClick={() => handleFileClick(doc)}
                  className="text-warning"
                >
                  <span className="flex-1">
                    {doc.title || "Untitled Document"}
                    {doc.days_until_expiry !== null && doc.days_until_expiry !== undefined && (
                      <span className="text-xs ml-2 opacity-70">
                        ({doc.days_until_expiry} days)
                      </span>
                    )}
                    {doc.expiry_date && (
                      <span className="text-xs ml-2 opacity-70">
                        ({formatExpiryDate(doc.expiry_date)})
                      </span>
                    )}
                  </span>
                  {doc.file_url && (
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  )}
                </FileItem>
              ))}
            </SubFiles>
          </FolderContent>
        </FolderItem>
      )}

      {groupedDocuments.valid.length > 0 && (
        <FolderItem value="valid">
          <FolderTrigger>
            Valid ({groupedDocuments.valid.length})
          </FolderTrigger>
          <FolderContent>
            <SubFiles>
              {groupedDocuments.valid.map((doc) => (
                <FileItem
                  key={doc.id}
                  icon={getStatusIcon("valid")}
                  onClick={() => handleFileClick(doc)}
                >
                  <span className="flex-1">
                    {doc.title || "Untitled Document"}
                    {doc.expiry_date && (
                      <span className="text-xs ml-2 opacity-70">
                        ({formatExpiryDate(doc.expiry_date)})
                      </span>
                    )}
                  </span>
                  {doc.file_url && (
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  )}
                </FileItem>
              ))}
            </SubFiles>
          </FolderContent>
        </FolderItem>
      )}

      {groupedDocuments.none.length > 0 && (
        <FolderItem value="none">
          <FolderTrigger>
            No Expiry Date ({groupedDocuments.none.length})
          </FolderTrigger>
          <FolderContent>
            <SubFiles>
              {groupedDocuments.none.map((doc) => (
                <FileItem
                  key={doc.id}
                  icon={getFileIcon()}
                  onClick={() => handleFileClick(doc)}
                >
                  <span className="flex-1">{doc.title || "Untitled Document"}</span>
                  {doc.file_url && (
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  )}
                </FileItem>
              ))}
            </SubFiles>
          </FolderContent>
        </FolderItem>
      )}
    </Files>
  );
}
