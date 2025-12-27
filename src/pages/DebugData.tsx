import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database } from "lucide-react";

interface OrgData {
  id: string;
  name: string;
  org_type: string;
  created_by: string;
  created_at: string;
}

interface PropertyData {
  id: string;
  org_id: string;
  address: string;
  created_at: string;
}

interface SpaceData {
  id: string;
  org_id: string;
  property_id: string;
  name: string;
  created_at: string;
}

interface MembershipData {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export default function DebugData() {
  const { orgId } = useActiveOrg();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [orgs, setOrgs] = useState<OrgData[]>([]);
  const [memberships, setMemberships] = useState<MembershipData[]>([]);
  const [properties, setProperties] = useState<PropertyData[]>([]);
  const [spaces, setSpaces] = useState<SpaceData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!currentUser) {
        setError("No user logged in");
        setLoading(false);
        return;
      }
      
      setUser(currentUser);

      // Fetch all orgs created by this user
      const { data: orgsData, error: orgsError } = await supabase
        .from('organisations')
        .select('*')
        .eq('created_by', currentUser.id)
        .order('created_at', { ascending: false });

      if (orgsError) {
        console.error("Error fetching orgs:", orgsError);
        setError(`Error fetching orgs: ${orgsError.message}`);
      } else {
        setOrgs(orgsData || []);
      }

      // Fetch all memberships for this user
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('organisation_members')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (membershipsError) {
        console.error("Error fetching memberships:", membershipsError);
        setError(`Error fetching memberships: ${membershipsError.message}`);
      } else {
        setMemberships(membershipsData || []);
      }

      // Fetch all properties in orgs where user is a member
      const orgIds = membershipsData?.map(m => m.org_id) || [];
      if (orgIds.length > 0) {
        const { data: propertiesData, error: propertiesError } = await supabase
          .from('properties')
          .select('*')
          .in('org_id', orgIds)
          .order('created_at', { ascending: false });

        if (propertiesError) {
          console.error("Error fetching properties:", propertiesError);
          setError(`Error fetching properties: ${propertiesError.message}`);
        } else {
          setProperties(propertiesData || []);
        }

        // Fetch all spaces in those properties
        const propertyIds = propertiesData?.map(p => p.id) || [];
        if (propertyIds.length > 0) {
          const { data: spacesData, error: spacesError } = await supabase
            .from('spaces')
            .select('*')
            .in('property_id', propertyIds)
            .order('created_at', { ascending: false });

          if (spacesError) {
            console.error("Error fetching spaces:", spacesError);
            setError(`Error fetching spaces: ${spacesError.message}`);
          } else {
            setSpaces(spacesData || []);
          }
        }
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="h-8 w-8" />
          Debug: User Data
        </h1>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Current User</CardTitle>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-2">
              <p><strong>ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Active Org ID:</strong> {orgId || "None"}</p>
            </div>
          ) : (
            <p>Loading user...</p>
          )}
        </CardContent>
      </Card>

      {/* Organisations */}
      <Card>
        <CardHeader>
          <CardTitle>Organisations Created by User ({orgs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : orgs.length === 0 ? (
            <p className="text-muted-foreground">No organisations found</p>
          ) : (
            <div className="space-y-4">
              {orgs.map((org) => (
                <div key={org.id} className="border rounded-lg p-4 space-y-2">
                  <p><strong>ID:</strong> {org.id}</p>
                  <p><strong>Name:</strong> {org.name}</p>
                  <p><strong>Type:</strong> {org.org_type}</p>
                  <p><strong>Created:</strong> {formatDate(org.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memberships */}
      <Card>
        <CardHeader>
          <CardTitle>Organisation Memberships ({memberships.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : memberships.length === 0 ? (
            <p className="text-muted-foreground">No memberships found</p>
          ) : (
            <div className="space-y-4">
              {memberships.map((membership) => (
                <div key={membership.id} className="border rounded-lg p-4 space-y-2">
                  <p><strong>Membership ID:</strong> {membership.id}</p>
                  <p><strong>Org ID:</strong> {membership.org_id}</p>
                  <p><strong>Role:</strong> {membership.role}</p>
                  <p><strong>Created:</strong> {formatDate(membership.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Properties */}
      <Card>
        <CardHeader>
          <CardTitle>Properties ({properties.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : properties.length === 0 ? (
            <p className="text-muted-foreground">No properties found</p>
          ) : (
            <div className="space-y-4">
              {properties.map((property) => (
                <div key={property.id} className="border rounded-lg p-4 space-y-2">
                  <p><strong>ID:</strong> {property.id}</p>
                  <p><strong>Org ID:</strong> {property.org_id}</p>
                  <p><strong>Address:</strong> {property.address}</p>
                  <p><strong>Created:</strong> {formatDate(property.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spaces */}
      <Card>
        <CardHeader>
          <CardTitle>Spaces ({spaces.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : spaces.length === 0 ? (
            <p className="text-muted-foreground">No spaces found</p>
          ) : (
            <div className="space-y-4">
              {spaces.map((space) => (
                <div key={space.id} className="border rounded-lg p-4 space-y-2">
                  <p><strong>ID:</strong> {space.id}</p>
                  <p><strong>Org ID:</strong> {space.org_id}</p>
                  <p><strong>Property ID:</strong> {space.property_id}</p>
                  <p><strong>Name:</strong> {space.name}</p>
                  <p><strong>Created:</strong> {formatDate(space.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

