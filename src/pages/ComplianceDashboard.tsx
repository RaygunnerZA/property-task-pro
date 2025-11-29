import { Heading } from '@/components/filla';
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

export default function ComplianceDashboard() {
  const overview = useComplianceOverview();
  const statusDistribution = useRuleStatusDistribution();
  const propertyHeatmap = usePropertyDriftHeatmap();
  const recentActivity = useRecentActivity();

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <Heading variant="xl">Compliance Dashboard</Heading>
              <p className="text-neutral-600 text-sm mt-1">
                Real-time compliance monitoring and analytics
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
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
    </div>
  );
}
