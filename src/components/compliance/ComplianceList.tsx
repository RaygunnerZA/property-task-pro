import { useMemo, useState } from "react";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar, type FilterOption, type FilterGroup } from "@/components/ui/filters/FilterBar";
import { AlertTriangle, CheckCircle2, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, isPast, parseISO } from "date-fns";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { Shield } from "lucide-react";

interface ComplianceListProps {
  propertyId?: string;
}

export function ComplianceList({ propertyId }: ComplianceListProps = {}) {
  const { data: documentsData = [], isLoading: loading, error } = useComplianceQuery(propertyId);
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());

  // Documents are already filtered by property_id from the query (though compliance_view doesn't have property_id)
  // The view already calculates expiry_status and days_until_expiry
  const documentsWithStatus = useMemo(() => {
    return documentsData.map((doc: any) => ({
      ...doc,
      expiryStatus: doc.expiry_status || "none",
      daysUntilExpiry: doc.days_until_expiry,
    }));
  }, [propertyDocuments]);

  // Filter documents based on selected filters
  const filteredDocuments = useMemo(() => {
    let filtered = [...documentsWithStatus];

    // Primary filters
    if (selectedFilters.has("filter-expired")) {
      filtered = filtered.filter((doc) => doc.expiryStatus === "expired");
    }

    if (selectedFilters.has("filter-expiring")) {
      filtered = filtered.filter((doc) => doc.expiryStatus === "expiring");
    }

    if (selectedFilters.has("filter-valid")) {
      filtered = filtered.filter((doc) => doc.expiryStatus === "valid");
    }

    // Secondary filters - Completeness
    if (selectedFilters.has("filter-completeness-complete")) {
      filtered = filtered.filter((doc) => doc.status === "complete" || doc.status === "approved");
    }

    if (selectedFilters.has("filter-completeness-incomplete")) {
      filtered = filtered.filter((doc) => doc.status !== "complete" && doc.status !== "approved");
    }

    // Secondary filters - Category (simplified - check if category field exists)
    const categoryFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-category-"));
    if (categoryFilterIds.length > 0) {
      const selectedCategories = categoryFilterIds.map(f => f.replace("filter-category-", ""));
      filtered = filtered.filter((doc) => {
        const docCategory = (doc as any).category;
        return docCategory && selectedCategories.includes(docCategory);
      });
    }

    return filtered;
  }, [documentsWithStatus, selectedFilters]);

  // Get unique categories from documents
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    documentsWithStatus.forEach((doc) => {
      const category = (doc as any).category;
      if (category) {
        categorySet.add(category);
      }
    });
    return Array.from(categorySet);
  }, [documentsWithStatus]);

  // Filter options
  const primaryOptions: FilterOption[] = [
    {
      id: "filter-expired",
      label: "Expired",
      icon: <AlertTriangle className="h-3 w-3" />,
      color: "#EB6834", // Destructive color (red)
    },
    {
      id: "filter-expiring",
      label: "Expiring Soon",
      icon: <AlertTriangle className="h-3 w-3" />,
      color: "#F59E0B", // Amber/warning color
    },
    {
      id: "filter-valid",
      label: "Valid",
      icon: <CheckCircle2 className="h-3 w-3" />,
      color: "#10B981", // Green/success color
    },
  ];

  const secondaryGroups: FilterGroup[] = [
    {
      id: "completeness",
      label: "Completeness",
      options: [
        {
          id: "filter-completeness-complete",
          label: "Complete",
          icon: <CheckCircle2 className="h-3 w-3" />,
        },
        {
          id: "filter-completeness-incomplete",
          label: "Incomplete",
          icon: <FileText className="h-3 w-3" />,
        },
      ],
    },
    {
      id: "category",
      label: "Category",
      options: categories.map((category) => ({
        id: `filter-category-${category}`,
        label: category,
        icon: <FileText className="h-3 w-3" />,
      })),
    },
  ];

  const handleFilterChange = (filterId: string, selected: boolean) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(filterId);
      } else {
        next.delete(filterId);
      }
      return next;
    });
  };

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

  if (loading) {
    return <LoadingState message="Loading compliance documents..." />;
  }

  if (error) {
    return <EmptyState title="Unable to load compliance documents" subtitle={error?.message || String(error)} />;
  }

  if (documentsData.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No compliance documents"
        subtitle="Upload your first compliance document to get started"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar
        primaryOptions={primaryOptions}
        secondaryGroups={secondaryGroups}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
      />

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <EmptyState
          title="No documents match filters"
          subtitle="Try adjusting your filters"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
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
    </div>
  );
}

