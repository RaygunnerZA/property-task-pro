import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { useCompliance } from "@/hooks/use-compliance";
import { DocumentUploadDialog } from "@/components/compliance/DocumentUploadDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, CheckCircle2, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, isPast, parseISO } from "date-fns";

const Compliance = () => {
  const navigate = useNavigate();
  const { documents, loading, error, refresh } = useCompliance();

  // Calculate expiry status for each document
  const documentsWithStatus = useMemo(() => {
    return documents.map((doc) => {
      if (!doc.expiry_date) {
        return { ...doc, expiryStatus: "none" as const, daysUntilExpiry: null };
      }

      try {
        const expiryDate = parseISO(doc.expiry_date);
        const daysUntilExpiry = differenceInDays(expiryDate, new Date());
        const isExpired = isPast(expiryDate);

        if (isExpired) {
          return { ...doc, expiryStatus: "expired" as const, daysUntilExpiry: Math.abs(daysUntilExpiry) };
        } else if (daysUntilExpiry <= 30) {
          return { ...doc, expiryStatus: "expiring" as const, daysUntilExpiry };
        } else {
          return { ...doc, expiryStatus: "valid" as const, daysUntilExpiry };
        }
      } catch {
        return { ...doc, expiryStatus: "none" as const, daysUntilExpiry: null };
      }
    });
  }, [documents]);

  const getExpiryBadge = (status: "expired" | "expiring" | "valid" | "none", days: number | null) => {
    switch (status) {
      case "expired":
        return (
          <Badge className="bg-red-500/10 text-red-700 border-red-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expired {days !== null && `(${days} days ago)`}
          </Badge>
        );
      case "expiring":
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expiring in {days} days
          </Badge>
        );
      case "valid":
        return (
          <Badge className="bg-green-500/10 text-green-700 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Valid
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header
          className={cn(
            "sticky top-0 z-40",
            "bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
            "shadow-[inset_0_-1px_2px_rgba(0,0,0,0.05)]"
          )}
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header
          className={cn(
            "sticky top-0 z-40",
            "bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
            "shadow-[inset_0_-1px_2px_rgba(0,0,0,0.05)]"
          )}
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-destructive">Error: {error}</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header
        className={cn(
          "sticky top-0 z-40",
          "bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
          "shadow-[inset_0_-1px_2px_rgba(0,0,0,0.05)]"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-[#8EC9CE]" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
              <p className="text-sm text-muted-foreground">
                {documents.length} document{documents.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <DocumentUploadDialog onDocumentCreated={refresh} />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {documents.length === 0 ? (
          <Card className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No compliance documents</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Upload your first compliance document to get started
            </p>
            <DocumentUploadDialog onDocumentCreated={refresh} />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documentsWithStatus.map((doc) => (
              <Card
                key={doc.id}
                className={cn(
                  "hover:shadow-md transition-shadow cursor-pointer",
                  doc.expiryStatus === "expired" && "border-red-500/20",
                  doc.expiryStatus === "expiring" && "border-amber-500/20"
                )}
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <span className="line-clamp-2">
                        {(doc as any).title || "Untitled Document"}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {getExpiryBadge(doc.expiryStatus, doc.daysUntilExpiry)}
                  
                  {doc.expiry_date && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Expiry:</span>{" "}
                      {format(parseISO(doc.expiry_date), "MMM d, yyyy")}
                    </div>
                  )}

                  {doc.status && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Status:</span> {doc.status}
                    </div>
                  )}

                  {(doc as any).file_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open((doc as any).file_url, "_blank");
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Document
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Compliance;

