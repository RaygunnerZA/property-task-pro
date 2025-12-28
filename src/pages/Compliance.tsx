import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCompliance } from "@/hooks/use-compliance";
import { DocumentUploadDialog } from "@/components/compliance/DocumentUploadDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle2, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, isPast, parseISO } from "date-fns";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { ErrorState } from "@/components/design-system/ErrorState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import DashboardSection from "@/components/dashboard/DashboardSection";
import ComplianceOverviewCard from "@/components/dashboard/ComplianceOverviewCard";
import RuleStatusDistribution from "@/components/dashboard/RuleStatusDistribution";
import PropertyDriftHeatmap from "@/components/dashboard/PropertyDriftHeatmap";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import { useComplianceOverview } from "@/hooks/useComplianceOverview";
import { useRuleStatusDistribution } from "@/hooks/useRuleStatusDistribution";
import { usePropertyDriftHeatmap } from "@/hooks/usePropertyDriftHeatmap";
import { useRecentActivity } from "@/hooks/useRecentActivity";

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
          <Badge variant="danger">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expired {days !== null && `(${days} days ago)`}
          </Badge>
        );
      case "expiring":
        return (
          <Badge variant="warning">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expiring in {days} days
          </Badge>
        );
      case "valid":
        return (
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Valid
          </Badge>
        );
      default:
        return null;
    }
  };

  // Dashboard data hooks
  const overview = useComplianceOverview();
  const statusDistribution = useRuleStatusDistribution();
  const propertyHeatmap = usePropertyDriftHeatmap();
  const recentActivity = useRecentActivity();

  return (
    <StandardPage
      title="Compliance"
      subtitle={`${documents.length} document${documents.length !== 1 ? "s" : ""}`}
      icon={<Shield className="h-6 w-6" />}
      action={
        <DocumentUploadDialog 
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          onDocumentCreated={() => {
            refresh();
            setShowUploadDialog(false);
          }} 
        />
      }
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Dashboard Section */}
        {/* Overview Section */}
        <DashboardSection title="Overview">
          {overview.loading ? (
            <div className="animate-pulse">
              <div className="h-32 bg-card rounded-lg shadow-e1" />
            </div>
          ) : overview.data ? (
            <ComplianceOverviewCard data={overview.data} />
          ) : null}
        </DashboardSection>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <DashboardSection title="Rule Status">
            {statusDistribution.loading ? (
              <div className="animate-pulse">
                <div className="h-48 bg-card rounded-lg shadow-e1" />
              </div>
            ) : (
              <RuleStatusDistribution data={statusDistribution.data} />
            )}
          </DashboardSection>

          {/* Recent Activity */}
          <DashboardSection title="Recent Activity">
            {recentActivity.loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-16 bg-card rounded-lg shadow-e1" />
                <div className="h-16 bg-card rounded-lg shadow-e1" />
                <div className="h-16 bg-card rounded-lg shadow-e1" />
              </div>
            ) : (
              <RecentActivityFeed data={recentActivity.data} />
            )}
          </DashboardSection>
        </div>

        {/* Property Heatmap */}
        <DashboardSection title="Property Compliance">
          {propertyHeatmap.loading ? (
            <div className="animate-pulse">
              <div className="h-64 bg-card rounded-lg shadow-e1" />
            </div>
          ) : (
            <PropertyDriftHeatmap data={propertyHeatmap.data} />
          )}
        </DashboardSection>

        {/* Documents Section */}
        <DashboardSection title="Compliance Documents">
          {loading ? (
            <LoadingState message="Loading compliance documents..." />
          ) : error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No compliance documents"
              description="Upload your first compliance document to get started"
              action={{
                label: "Upload Document",
                onClick: () => setShowUploadDialog(true),
                icon: FileText
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documentsWithStatus.map((doc) => (
                <Card
                  key={doc.id}
                  className={cn(
                    "shadow-e1 hover:shadow-md transition-shadow cursor-pointer",
                    doc.expiryStatus === "expired" && "border-destructive/20",
                    doc.expiryStatus === "expiring" && "border-warning/20"
                  )}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-start gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <span className="line-clamp-2">
                        {(doc as any).title || "Untitled Document"}
                      </span>
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
                      <NeomorphicButton
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open((doc as any).file_url, "_blank");
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Document
                      </NeomorphicButton>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DashboardSection>
      </div>
    </StandardPage>
  );
};

export default Compliance;

