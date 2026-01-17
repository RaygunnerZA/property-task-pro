import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { useQueryClient } from "@tanstack/react-query";
import { DocumentUploadDialog } from "@/components/compliance/DocumentUploadDialog";
import { ComplianceFiles } from "@/components/compliance/ComplianceFiles";
import { Shield, FileText } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { ErrorState } from "@/components/design-system/ErrorState";
import { EmptyState } from "@/components/design-system/EmptyState";
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
  const { data: documentsData = [], isLoading: loading, error } = useComplianceQuery();
  const queryClient = useQueryClient();
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Check for ?add=true in URL to open dialog
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setShowUploadDialog(true);
      // Remove the query param from URL
      navigate('/record/compliance', { replace: true });
    }
  }, [searchParams, navigate]);

  // compliance_view already calculates expiry_status and days_until_expiry
  const documents = documentsData;

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
            queryClient.invalidateQueries({ queryKey: ["compliance"] });
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
            <ErrorState message={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ["compliance"] })} />
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
            <div className="bg-card rounded-lg shadow-sm p-4">
              <ComplianceFiles documents={documents} />
            </div>
          )}
        </DashboardSection>
      </div>
    </StandardPage>
  );
};

export default Compliance;

