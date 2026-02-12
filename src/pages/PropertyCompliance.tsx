import { useParams } from "react-router-dom";
import { useMemo } from "react";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { ComplianceCard } from "@/components/compliance/ComplianceCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

export default function PropertyCompliance() {
  const { id } = useParams<{ id: string }>();
  const { data: compliance = [], isLoading } = useComplianceQuery(id || undefined);

  const { expired, expiring, upcoming } = useMemo(() => {
    const expired = compliance.filter((c: any) => c.expiry_status === "expired");
    const expiring = compliance.filter((c: any) => c.expiry_status === "expiring");
    const upcoming = compliance.filter(
      (c: any) => c.expiry_status === "valid" || c.expiry_status === "none"
    );
    return { expired, expiring, upcoming };
  }, [compliance]);

  // Sort by urgency
  const sortedExpired = useMemo(
    () => [...expired].sort((a, b) => (a.days_until_expiry ?? 0) - (b.days_until_expiry ?? 0)),
    [expired]
  );
  const sortedExpiring = useMemo(
    () => [...expiring].sort((a, b) => (a.days_until_expiry ?? 0) - (b.days_until_expiry ?? 0)),
    [expiring]
  );
  const sortedUpcoming = useMemo(
    () => [...upcoming].sort((a, b) => (a.days_until_expiry ?? Infinity) - (b.days_until_expiry ?? Infinity)),
    [upcoming]
  );

  return (
    <StandardPageWithBack
      title="Property Compliance"
      backTo={`/properties/${id}`}
      icon={<Shield className="h-6 w-6" />}
      maxWidth="lg"
    >
      {isLoading ? (
        <LoadingState message="Loading property compliance..." />
      ) : (
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="mb-6 w-full grid grid-cols-2">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6 mt-0">
            {/* Expired */}
            <section>
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Expired ({sortedExpired.length})
              </h2>
              {sortedExpired.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No expired items"
                  description="All compliance items are up to date"
                />
              ) : (
                <div className="space-y-2">
                  {sortedExpired.map((item) => (
                    <ComplianceCard key={item.id} compliance={item} />
                  ))}
                </div>
              )}
            </section>

            {/* Expiring soon */}
            <section>
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Expiring soon ({sortedExpiring.length})
              </h2>
              {sortedExpiring.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="None expiring soon"
                  description="No items due within 30 days"
                />
              ) : (
                <div className="space-y-2">
                  {sortedExpiring.map((item) => (
                    <ComplianceCard key={item.id} compliance={item} />
                  ))}
                </div>
              )}
            </section>

            {/* Upcoming */}
            <section>
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Upcoming ({sortedUpcoming.length})
              </h2>
              {sortedUpcoming.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No upcoming items"
                  description="Add compliance items to see them here"
                />
              ) : (
                <div className="space-y-2">
                  {sortedUpcoming.map((item) => (
                    <ComplianceCard key={item.id} compliance={item} />
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="overview" className="space-y-4 mt-0">
            {compliance.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No compliance items"
                description="Compliance items for this property will appear here"
              />
            ) : (
              <div className="space-y-2">
                {compliance.map((item) => (
                  <ComplianceCard key={item.id} compliance={item} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </StandardPageWithBack>
  );
}
