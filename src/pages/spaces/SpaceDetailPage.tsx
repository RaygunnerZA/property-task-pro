import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSpaceDetail } from "@/hooks/useSpaceDetail";
import { useSpaceComplianceQuery } from "@/hooks/useSpaceComplianceQuery";
import { useSpaceDocumentsQuery } from "@/hooks/useSpaceDocumentsQuery";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { ComplianceCard } from "@/components/compliance/ComplianceCard";
import { FolderOpen, Package, Shield, FileText, Network } from "lucide-react";
import { GraphTabContent } from "@/components/graph/GraphTabContent";
import { cn } from "@/lib/utils";

export default function SpaceDetailPage() {
  const { propertyId, spaceId } = useParams<{ propertyId: string; spaceId: string }>();
  const navigate = useNavigate();
  const { data: space, isLoading: spaceLoading } = useSpaceDetail(spaceId);
  const { data: compliance = [], isLoading: complianceLoading } = useSpaceComplianceQuery(spaceId);
  const { data: documents = [], isLoading: documentsLoading } = useSpaceDocumentsQuery(spaceId, propertyId);
  const { data: allAssets = [] } = useAssetsQuery(propertyId);

  const assetsInSpace = useMemo(() => {
    return allAssets.filter((a: any) => a.space_id === spaceId);
  }, [allAssets, spaceId]);

  const complianceWithStatus = useMemo(
    () =>
      compliance.map((c: any) => ({
        ...c,
        expiry_status: c.expiry_state,
      })),
    [compliance]
  );

  if (spaceLoading || !space) {
    return (
      <StandardPageWithBack
        title="Space"
        backTo={`/properties/${propertyId}`}
        icon={<FolderOpen className="h-6 w-6" />}
        maxWidth="lg"
      >
        <LoadingState message="Loading space..." />
      </StandardPageWithBack>
    );
  }

  const spaceName = space.name || "Unnamed Space";
  const propertyName = space.properties?.nickname || space.properties?.address || "Property";

  return (
    <StandardPageWithBack
      title={spaceName}
      subtitle={propertyName}
      backTo={`/properties/${propertyId}`}
      icon={<FolderOpen className="h-6 w-6" />}
      maxWidth="lg"
    >
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 w-full grid grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="graph">
            <Network className="h-4 w-4 mr-2" />
            Graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-4">
          <div className="rounded-lg bg-card p-4 shadow-e1">
            <h3 className="font-semibold text-foreground mb-2">Space Details</h3>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd>{spaceName}</dd>
              </div>
              {space.floor_level && (
                <div>
                  <dt className="text-muted-foreground">Floor</dt>
                  <dd>{space.floor_level}</dd>
                </div>
              )}
              {space.area_sqm != null && (
                <div>
                  <dt className="text-muted-foreground">Area</dt>
                  <dd>{space.area_sqm} m²</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => navigate(`/properties/${propertyId}`)}
              className="p-4 rounded-lg bg-card shadow-e1 text-left hover:shadow-e2 transition-shadow"
            >
              <Package className="h-5 w-5 text-primary mb-2" />
              <div className="font-semibold">{assetsInSpace.length}</div>
              <div className="text-xs text-muted-foreground">Assets in this space</div>
            </button>
            <button
              type="button"
              onClick={() => {}}
              className="p-4 rounded-lg bg-card shadow-e1 text-left hover:shadow-e2 transition-shadow"
            >
              <Shield className="h-5 w-5 text-primary mb-2" />
              <div className="font-semibold">{compliance.length}</div>
              <div className="text-xs text-muted-foreground">Compliance items</div>
            </button>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="mt-0">
          {assetsInSpace.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No assets"
              description="No assets are assigned to this space"
            />
          ) : (
            <div className="space-y-2">
              {assetsInSpace.map((asset: any) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {}}
                  className={cn(
                    "w-full p-4 rounded-lg text-left",
                    "bg-card shadow-e1 hover:shadow-e2 transition-all"
                  )}
                >
                  <div className="font-medium">{asset.name || "Unnamed Asset"}</div>
                  {asset.asset_type && (
                    <div className="text-xs text-muted-foreground">{asset.asset_type}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="mt-0">
          {complianceLoading ? (
            <LoadingState message="Loading compliance..." />
          ) : complianceWithStatus.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No compliance linked"
              description="Link compliance items to this space to see them here"
            />
          ) : (
            <div className="space-y-2">
              {complianceWithStatus.map((item) => (
                <ComplianceCard key={item.id} compliance={item} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          {documentsLoading ? (
            <LoadingState message="Loading documents..." />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents"
              description="Documents linked to this space will appear here"
            />
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any) => (
                <a
                  key={doc.id}
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "block p-4 rounded-lg",
                    "bg-card shadow-e1 hover:shadow-e2 transition-all"
                  )}
                >
                  <div className="font-medium">{doc.title || doc.file_name || "Document"}</div>
                  {doc.document_type && (
                    <div className="text-xs text-muted-foreground">{doc.document_type}</div>
                  )}
                </a>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="graph" className="mt-0">
          {spaceId && (
            <GraphTabContent start={{ type: "space", id: spaceId }} depth={3} />
          )}
        </TabsContent>
      </Tabs>
    </StandardPageWithBack>
  );
}
