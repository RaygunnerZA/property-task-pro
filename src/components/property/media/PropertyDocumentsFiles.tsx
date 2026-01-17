import { useMemo } from "react";
import { Files, FolderItem, FolderTrigger, FolderContent, SubFiles, FileItem } from "@/components/ui/files";
import { FileText, FileImage, File, FileType } from "lucide-react";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { PropertyDocument } from "@/hooks/property/usePropertyDocuments";

interface PropertyDocumentsFilesProps {
  documents: PropertyDocument[];
  onDocumentClick?: (document: PropertyDocument) => void;
}

const getFileExtension = (fileName: string): string => {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

const getFileIcon = (fileName: string) => {
  const ext = getFileExtension(fileName);
  
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return FileImage;
  }
  if (["pdf"].includes(ext)) {
    return FileText;
  }
  if (["doc", "docx", "txt", "md"].includes(ext)) {
    return FileType;
  }
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function PropertyDocumentsFiles({ 
  documents, 
  onDocumentClick 
}: PropertyDocumentsFilesProps) {
  const groupedDocuments = useMemo(() => {
    const byType: Record<string, PropertyDocument[]> = {
      pdf: [],
      image: [],
      document: [],
      other: [],
    };

    documents.forEach((doc) => {
      const ext = getFileExtension(doc.name);
      
      if (ext === "pdf") {
        byType.pdf.push(doc);
      } else if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
        byType.image.push(doc);
      } else if (["doc", "docx", "txt", "md"].includes(ext)) {
        byType.document.push(doc);
      } else {
        byType.other.push(doc);
      }
    });

    return byType;
  }, [documents]);

  const handleFileClick = (doc: PropertyDocument) => {
    if (onDocumentClick) {
      onDocumentClick(doc);
    } else if (doc.url) {
      window.open(doc.url, "_blank");
    }
  };

  return (
    <Files type="multiple" defaultValue={[]} className="w-full">
      {groupedDocuments.pdf.length > 0 && (
        <FolderItem value="pdf">
          <FolderTrigger>
            PDF Documents ({groupedDocuments.pdf.length})
          </FolderTrigger>
          <FolderContent>
            <SubFiles>
              {groupedDocuments.pdf.map((doc) => (
                <FileItem
                  key={doc.id}
                  icon={getFileIcon(doc.name)}
                  onClick={() => handleFileClick(doc)}
                >
                  <span className="flex-1 flex items-center gap-2">
                    <span>{doc.name}</span>
                    <span className="text-xs opacity-70">
                      {formatFileSize(doc.size)}
                    </span>
                    <span className="text-xs opacity-70">
                      {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                    </span>
                  </span>
                  {doc.url && (
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  )}
                </FileItem>
              ))}
            </SubFiles>
          </FolderContent>
        </FolderItem>
      )}

      {groupedDocuments.image.length > 0 && (
        <FolderItem value="image">
          <FolderTrigger>
            Images ({groupedDocuments.image.length})
          </FolderTrigger>
          <FolderContent>
            <SubFiles>
              {groupedDocuments.image.map((doc) => (
                <FileItem
                  key={doc.id}
                  icon={getFileIcon(doc.name)}
                  onClick={() => handleFileClick(doc)}
                >
                  <span className="flex-1 flex items-center gap-2">
                    <span>{doc.name}</span>
                    <span className="text-xs opacity-70">
                      {formatFileSize(doc.size)}
                    </span>
                    <span className="text-xs opacity-70">
                      {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                    </span>
                  </span>
                  {doc.url && (
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  )}
                </FileItem>
              ))}
            </SubFiles>
          </FolderContent>
        </FolderItem>
      )}

      {groupedDocuments.document.length > 0 && (
        <FolderItem value="document">
          <FolderTrigger>
            Documents ({groupedDocuments.document.length})
          </FolderTrigger>
          <FolderContent>
            <SubFiles>
              {groupedDocuments.document.map((doc) => (
                <FileItem
                  key={doc.id}
                  icon={getFileIcon(doc.name)}
                  onClick={() => handleFileClick(doc)}
                >
                  <span className="flex-1 flex items-center gap-2">
                    <span>{doc.name}</span>
                    <span className="text-xs opacity-70">
                      {formatFileSize(doc.size)}
                    </span>
                    <span className="text-xs opacity-70">
                      {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                    </span>
                  </span>
                  {doc.url && (
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  )}
                </FileItem>
              ))}
            </SubFiles>
          </FolderContent>
        </FolderItem>
      )}

      {groupedDocuments.other.length > 0 && (
        <FolderItem value="other">
          <FolderTrigger>
            Other Files ({groupedDocuments.other.length})
          </FolderTrigger>
          <FolderContent>
            <SubFiles>
              {groupedDocuments.other.map((doc) => (
                <FileItem
                  key={doc.id}
                  icon={getFileIcon(doc.name)}
                  onClick={() => handleFileClick(doc)}
                >
                  <span className="flex-1 flex items-center gap-2">
                    <span>{doc.name}</span>
                    <span className="text-xs opacity-70">
                      {formatFileSize(doc.size)}
                    </span>
                    <span className="text-xs opacity-70">
                      {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                    </span>
                  </span>
                  {doc.url && (
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  )}
                </FileItem>
              ))}
            </SubFiles>
          </FolderContent>
        </FolderItem>
      )}

      {documents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No documents available</p>
        </div>
      )}
    </Files>
  );
}
