import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { useCompliance } from "@/hooks/use-compliance";
import { DocumentUploadDialog } from "@/components/compliance/DocumentUploadDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, CheckCircle2, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, isPast, parseISO } from "date-fns";
import { PageHeader } from "@/components/design-system/PageHeader";

const Compliance = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { documents, loading, error, refresh } = useCompliance();
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Check for ?add=true in URL to open dialog
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setShowUploadDialog(true);
      // Remove the query param from URL
      navigate('/record/compliance', { replace: true });
    }
  }, [searchParams, navigate]);

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
          <Badge variant="danger" size="standard">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expired {days !== null && `(${days} days ago)`}
          </Badge>
        );
      case "expiring":
        return (
          <Badge variant="warning" size="standard">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expiring in {days} days
          </Badge>
        );
      case "valid":
        return (
          <Badge variant="success" size="standard">
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
        <PageHeader>
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
          </div>
        </PageHeader>
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
        <PageHeader>
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
          </div>
        </PageHeader>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-destructive">Error: {error}</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 icon-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
              <p className="text-sm text-muted-foreground">
                {documents.length} document{documents.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <DocumentUploadDialog 
            open={showUploadDialog}
            onOpenChange={setShowUploadDialog}
            onDocumentCreated={() => {
              refresh();
              setShowUploadDialog(false);
            }} 
          />
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {documents.length === 0 ? (
          <Card className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No compliance documents</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Upload your first compliance document to get started
            </p>
            <DocumentUploadDialog 
              open={showUploadDialog}
              onOpenChange={setShowUploadDialog}
              onDocumentCreated={() => {
                refresh();
                setShowUploadDialog(false);
              }} 
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documentsWithStatus.map((doc) => (
              <Card
                key={doc.id}
                className={cn(
                  "hover:shadow-md transition-shadow cursor-pointer",
                  doc.expiryStatus === "expired" && "border-destructive/20",
                  doc.expiryStatus === "expiring" && "border-warning/20"
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

