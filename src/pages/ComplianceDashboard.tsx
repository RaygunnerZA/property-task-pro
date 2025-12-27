import DashboardSection from '@/components/dashboard/DashboardSection';
import ComplianceOverviewCard from '@/components/dashboard/ComplianceOverviewCard';
import RuleStatusDistribution from '@/components/dashboard/RuleStatusDistribution';
import PropertyDriftHeatmap from '@/components/dashboard/PropertyDriftHeatmap';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { useComplianceOverview } from '@/hooks/useComplianceOverview';
import { useRuleStatusDistribution } from '@/hooks/useRuleStatusDistribution';
import { usePropertyDriftHeatmap } from '@/hooks/usePropertyDriftHeatmap';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { BarChart3 } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';

export default function ComplianceDashboard() {
  const overview = useComplianceOverview();
  const statusDistribution = useRuleStatusDistribution();
  const propertyHeatmap = usePropertyDriftHeatmap();
  const recentActivity = useRecentActivity();

  return (
    <StandardPage
      title="Compliance Dashboard"
      subtitle="Real-time compliance monitoring and analytics"
      icon={<BarChart3 className="h-6 w-6" />}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Overview Section */}
        <DashboardSection title="Overview">
          {overview.loading ? (
            <div className="animate-pulse">
              <div className="h-32 bg-neutral-200 rounded-lg" />
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
                <div className="h-48 bg-neutral-200 rounded-lg" />
              </div>
            ) : (
              <RuleStatusDistribution data={statusDistribution.data} />
            )}
          </DashboardSection>

          {/* Recent Activity */}
          <DashboardSection title="Recent Activity">
            {recentActivity.loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-16 bg-neutral-200 rounded-lg" />
                <div className="h-16 bg-neutral-200 rounded-lg" />
                <div className="h-16 bg-neutral-200 rounded-lg" />
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
              <div className="h-64 bg-neutral-200 rounded-lg" />
            </div>
          ) : (
            <PropertyDriftHeatmap data={propertyHeatmap.data} />
          )}
        </DashboardSection>
      </div>
    </StandardPage>
  );
}
