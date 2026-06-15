import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { DevModeProvider, isDevBuild } from "@/context/DevModeContext";
import { SystemStatusProvider } from "@/providers/SystemStatusProvider";
import { ActiveOrgProvider } from "@/providers/ActiveOrgProvider";
import { DataProvider, useAuth, useDataContext } from "@/contexts/DataContext";
import { AppInitializer } from "@/components/AppInitializer";
import { AuthHashHandler } from "@/components/AuthHashHandler";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { LoadingState } from "@/components/design-system/LoadingState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "@/pages/Login";
import { initAnalytics, identifyUser, resetAnalyticsUser } from "@/lib/analytics";
// Onboarding wizard — eager imports so step-to-step navigation never hits a lazy chunk fetch failure.
import CreateOrganisationScreen from "./pages/onboarding/CreateOrganisationScreen";
import AddPropertyScreen from "./pages/onboarding/AddPropertyScreen";
import AddSpaceScreen from "./pages/onboarding/AddSpaceScreen";
import InviteTeamScreen from "./pages/onboarding/InviteTeamScreen";

initAnalytics();

function RouteBoundary({ title, children }: { title: string; children: ReactNode }) {
  return <ErrorBoundary regionTitle={title}>{children}</ErrorBoundary>;
}

// Lazy load all page components (except Login and AppLayout which load instantly)
const NotFound = lazy(() => import("./pages/NotFound"));

// Onboarding screens
const WelcomeScreen = lazy(() => import("./pages/onboarding/WelcomeScreen"));
const SignUpScreen = lazy(() => import("./pages/onboarding/SignUpScreen"));
const VerifyEmailScreen = lazy(() => import("./pages/onboarding/VerifyEmailScreen"));
const PropertyProfileScreen = lazy(() => import("./pages/onboarding/PropertyProfileScreen"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const StaffOnboardingScreen = lazy(() => import("./pages/onboarding/StaffOnboardingScreen"));
const DesignLibrary = lazy(() => import("./pages/DesignLibrary"));

// WORK pillar
const WorkTasks = lazy(() => import("./pages/work/WorkTasks"));
const WorkInbox = lazy(() => import("./pages/work/WorkInbox"));
const WorkSchedule = lazy(() => import("./pages/work/WorkSchedule"));
const WorkAutomations = lazy(() => import("./pages/work/WorkAutomations"));

// MANAGE pillar
const ManageProperties = lazy(() => import("./pages/manage/ManageProperties"));
const ManageSpaces = lazy(() => import("./pages/manage/ManageSpaces"));
const ManageVendors = lazy(() => import("./pages/manage/ManageVendors"));
const ManageTemplates = lazy(() => import("./pages/manage/ManageTemplates"));
const ManageSettings = lazy(() => import("./pages/manage/ManageSettings"));
const Assets = lazy(() => import("./pages/Assets"));

// RECORD pillar
const RecordDocuments = lazy(() => import("./pages/record/RecordDocuments"));
const RecordCompliance = lazy(() => import("./pages/record/RecordCompliance"));
const ComplianceDashboard = lazy(() => import("./pages/ComplianceDashboard"));
const PortfolioCompliance = lazy(() => import("./pages/compliance/PortfolioCompliance"));
const ContractorCompliance = lazy(() => import("./pages/compliance/ContractorCompliance"));
const ComplianceCalendar = lazy(() => import("./pages/compliance/ComplianceCalendar"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ComplianceTasks = lazy(() => import("./pages/ComplianceTasks"));
const RecordHistory = lazy(() => import("./pages/record/RecordHistory"));
const RecordReports = lazy(() => import("./pages/record/RecordReports"));
const RecordLibrary = lazy(() => import("./pages/record/RecordLibrary"));

// Legacy pages (kept for deep links)
const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const AddTask = lazy(() => import("./pages/AddTask"));
const PropertyHubRedirect = lazy(() => import("./pages/PropertyHubRedirect"));
const PropertyCompliance = lazy(() => import("./pages/PropertyCompliance"));
const PropertyTasks = lazy(() => import("./pages/PropertyTasks"));
const PropertyPhotos = lazy(() => import("./pages/PropertyPhotos"));
const PropertyDocuments = lazy(() => import("./pages/PropertyDocuments"));
const PropertyBuildingPlans = lazy(() => import("./pages/PropertyBuildingPlans"));
const SpaceDetailPage = lazy(() => import("./pages/spaces/SpaceDetailPage"));
const SpaceOrganisationScreen = lazy(() => import("./pages/spaces/SpaceOrganisationScreen"));
const SpaceGroupScreen = lazy(() => import("./pages/spaces/SpaceGroupScreen"));
const ComplianceReviews = lazy(() => import("./pages/ComplianceReviews"));
const ReviewWorkspace = lazy(() => import("./pages/ReviewWorkspace"));
const ReviewSummary = lazy(() => import("./pages/ReviewSummary"));
const BatchRewrite = lazy(() => import("./pages/BatchRewrite"));
const RuleDetail = lazy(() => import("./pages/RuleDetail"));
const RuleVersions = lazy(() => import("./pages/RuleVersions"));
const VersionDetail = lazy(() => import("./pages/VersionDetail"));
const RuleCompliance = lazy(() => import("./pages/RuleCompliance"));
const AuditExport = lazy(() => import("./pages/AuditExport"));
const AccountDeveloper = lazy(() => import("./pages/AccountDeveloper"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard"));
const VendorTasks = lazy(() => import("./pages/VendorTasks"));
const VendorTaskDetail = lazy(() => import("./pages/VendorTaskDetail"));
const VendorProfile = lazy(() => import("./pages/VendorProfile"));
const VendorReporting = lazy(() => import("./pages/VendorReporting"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const Dashboard = lazy(() => import("./app/page"));
const Properties = lazy(() => import("./pages/Properties"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const Reports = lazy(() => import("./pages/Reports"));
const IssuesPage = lazy(() => import("./pages/workbench/IssuesPage"));
const RecordsPage = lazy(() => import("./pages/workbench/RecordsPage"));
const AgendaPage = lazy(() => import("./pages/workbench/AgendaPage"));
const Compliance = lazy(() => import("./pages/Compliance"));
const ContractorAccess = lazy(() => import("./pages/contractor/ContractorAccess"));
const ContractorTask = lazy(() => import("./pages/contractor/ContractorTask"));

// Settings pages
const SettingsLayout = lazy(() => import("./pages/settings/SettingsLayout").then(module => ({ default: module.SettingsLayout })));
const SettingsGeneral = lazy(() => import("./pages/settings/SettingsGeneral"));
const SettingsAutomationPanel = lazy(() => import("./pages/settings/SettingsAutomationPanel"));
const SettingsTeam = lazy(() => import("./pages/settings/SettingsTeam"));
const SettingsBilling = lazy(() => import("./pages/settings/SettingsBilling"));
const SettingsProfile = lazy(() => import("./pages/settings/SettingsProfile"));
const SettingsIntegrations = lazy(() => import("./pages/settings/SettingsIntegrations"));
const DebugData = lazy(() => import("./pages/DebugData"));

// Admin panel (lazy, guarded by AdminLayout)
const AdminLayout         = lazy(() => import("./pages/admin/AdminLayout"));
const AdminOrgList        = lazy(() => import("./pages/admin/AdminOrgList"));
const AdminOrgDetail      = lazy(() => import("./pages/admin/AdminOrgDetail"));
const AdminOrgAiRequests  = lazy(() => import("./pages/admin/AdminOrgAiRequests"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute - deduplicates requests
      gcTime: 300000, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false, // Prevent refetch on tab focus
    },
  },
});

/**
 * Renders under `ActiveOrgProvider` → `DataProvider`.
 * `useDataContext().orgId` is membership-backed (same as `useActiveOrg`), not JWT alone.
 * Calls identifyUser once the session and org are both resolved.
 * Calls resetAnalyticsUser on sign-out.
 */
function AnalyticsIdentifier() {
  const { user } = useAuth();
  const { orgId, organisation } = useDataContext();

  useEffect(() => {
    if (user?.id && orgId) {
      identifyUser(user.id, orgId, organisation?.name ?? "");
    }
  }, [user?.id, orgId, organisation?.name]);

  useEffect(() => {
    if (!user) {
      resetAnalyticsUser();
    }
  }, [user]);

  return null;
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <DevModeProvider>
      <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthHashHandler />
            <SystemStatusProvider>
              <StatusBanner />
              <ActiveOrgProvider>
                <DataProvider>
                  <AnalyticsIdentifier />
                  <AppInitializer>
                  <Suspense fallback={<LoadingState message="Loading..." />}>
                    <Routes>
                      {/* Onboarding routes (no layout) — each wrapped for isolated failure */}
                      <Route
                        path="/welcome"
                        element={
                          <RouteBoundary title="Welcome">
                            <WelcomeScreen />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/signup"
                        element={
                          <RouteBoundary title="Sign up">
                            <SignUpScreen />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/verify"
                        element={
                          <RouteBoundary title="Email verification">
                            <VerifyEmailScreen />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/accept-invitation"
                        element={
                          <RouteBoundary title="Accept invitation">
                            <AcceptInvitation />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/auth/callback"
                        element={
                          <RouteBoundary title="Authentication">
                            <AuthCallback />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/onboarding/property-profile"
                        element={
                          <RouteBoundary title="Property profile">
                            <PropertyProfileScreen />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/onboarding/create-organisation"
                        element={
                          <RouteBoundary title="Create organisation">
                            <CreateOrganisationScreen />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/onboarding/staff"
                        element={
                          <RouteBoundary title="Staff onboarding">
                            <StaffOnboardingScreen />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/onboarding/add-property"
                        element={
                          <RouteBoundary title="Add property">
                            <AddPropertyScreen />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/onboarding/add-spaces"
                        element={
                          <RouteBoundary title="Add spaces">
                            <AddSpaceScreen />
                          </RouteBoundary>
                        }
                      />
                      <Route
                        path="/onboarding/invite-team"
                        element={
                          <RouteBoundary title="Invite team">
                            <InviteTeamScreen />
                          </RouteBoundary>
                        }
                      />
                      
                      {/* Login route (no layout) */}
                      <Route path="/login" element={
                        <ErrorBoundary regionTitle="Sign in">
                          <Login />
                        </ErrorBoundary>
                      } />
                      
                      {/* Contractor routes (no auth required, no layout) */}
                      <Route path="/contractor/access" element={
                        <ErrorBoundary regionTitle="Contractor access">
                          <ContractorAccess />
                        </ErrorBoundary>
                      } />
                      <Route path="/contractor/task/:id" element={
                        <ErrorBoundary regionTitle="Contractor task">
                          <ContractorTask />
                        </ErrorBoundary>
                      } />
                      
                      {/* Admin panel — own layout, own guard, no AppLayout */}
                      <Route path="/admin" element={
                        <ProtectedRoute>
                          <Suspense fallback={<LoadingState message="Loading..." />}>
                            <AdminLayout />
                          </Suspense>
                        </ProtectedRoute>
                      }>
                        <Route index element={<Navigate to="/admin/orgs" replace />} />
                        <Route path="orgs" element={<RouteBoundary title="Admin — Orgs"><AdminOrgList /></RouteBoundary>} />
                        <Route path="orgs/:orgId" element={<RouteBoundary title="Admin — Org detail"><AdminOrgDetail /></RouteBoundary>} />
                        <Route path="orgs/:orgId/ai" element={<RouteBoundary title="Admin — AI requests"><AdminOrgAiRequests /></RouteBoundary>} />
                      </Route>

                      {/* All main app routes wrapped in AppLayout */}
                      <Route path="/*" element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Suspense fallback={<LoadingState message="Loading page..." />}>
                              <Routes>
                                {/* Dashboard */}
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/dashboard" element={<ManagerDashboard />} />

                                {/* Workbench pages (formerly Issues | Records | Schedule tabs) */}
                                <Route path="/issues" element={<RouteBoundary title="Issues"><IssuesPage /></RouteBoundary>} />
                                <Route path="/records" element={<RouteBoundary title="Records"><RecordsPage /></RouteBoundary>} />
                                <Route path="/agenda" element={<RouteBoundary title="Schedule"><AgendaPage /></RouteBoundary>} />
                                
                                {/* Main Navigation */}
                                <Route path="/properties" element={<RouteBoundary title="Properties"><Properties /></RouteBoundary>} />
                                <Route path="/tasks" element={<RouteBoundary title="My Tasks"><Tasks /></RouteBoundary>} />
                                <Route path="/calendar" element={<RouteBoundary title="Calendar"><CalendarPage /></RouteBoundary>} />
                                <Route path="/schedule" element={<Navigate to="/calendar" replace />} />
                                <Route path="/knowledge" element={<RouteBoundary title="Knowledge"><Knowledge /></RouteBoundary>} />
                                <Route path="/reports" element={<RouteBoundary title="Reports"><Reports /></RouteBoundary>} />
                                <Route path="/assets" element={<RouteBoundary title="Assets"><Assets /></RouteBoundary>} />
                                <Route path="/compliance" element={<RouteBoundary title="Compliance"><Compliance /></RouteBoundary>} />
                                
                                {/* WORK pillar */}
                                <Route path="/work/tasks" element={<WorkTasks />} />
                                <Route path="/work/inbox" element={<WorkInbox />} />
                                <Route path="/work/schedule" element={<WorkSchedule />} />
                                <Route path="/work/automations" element={<WorkAutomations />} />
                                
                                {/* MANAGE pillar */}
                                <Route path="/manage/properties" element={<ManageProperties />} />
                                <Route path="/manage/spaces" element={<ManageSpaces />} />
                                <Route path="/assets" element={<Assets />} />
                                <Route path="/manage/people" element={<Navigate to="/settings/team" replace />} />
                                <Route path="/manage/vendors" element={<ManageVendors />} />
                                <Route path="/manage/templates" element={<ManageTemplates />} />
                                <Route path="/manage/settings" element={<ManageSettings />} />
                                
                                {/* Settings routes */}
                                <Route path="/settings" element={<RouteBoundary title="Settings"><SettingsLayout /></RouteBoundary>}>
                                  <Route index element={<RouteBoundary title="Settings — General"><SettingsGeneral /></RouteBoundary>} />
                                  <Route path="profile" element={<RouteBoundary title="Settings — Profile"><SettingsProfile /></RouteBoundary>} />
                                  <Route path="automation" element={<RouteBoundary title="Settings — Automation"><SettingsAutomationPanel /></RouteBoundary>} />
                                  <Route path="integrations" element={<RouteBoundary title="Settings — Integrations"><SettingsIntegrations /></RouteBoundary>} />
                                  <Route path="team" element={<RouteBoundary title="Settings — Team"><SettingsTeam /></RouteBoundary>} />
                                  <Route path="billing" element={<RouteBoundary title="Settings — Billing"><SettingsBilling /></RouteBoundary>} />
                                </Route>
                                
                                {/* RECORD pillar */}
                                <Route path="/record/documents" element={<RecordDocuments />} />
                                <Route path="/record/compliance" element={<RecordCompliance />}>
                                  <Route index element={<ComplianceDashboard />} />
                                  <Route path="tasks" element={<ComplianceTasks />} />
                                  <Route path="portfolio" element={<PortfolioCompliance />} />
                                  <Route path="contractors" element={<ContractorCompliance />} />
                                  <Route path="calendar" element={<ComplianceCalendar />} />
                                </Route>
                                <Route path="/record/history" element={<RecordHistory />} />
                                <Route path="/record/reports" element={<RecordReports />} />
                                <Route path="/record/library" element={<RecordLibrary />} />
                                
                                {/* Legacy/deep-link routes */}
                                <Route path="/task/:id" element={<TaskDetail />} />
                                <Route path="/add-task" element={<AddTask />} />
                                <Route path="/properties/:id" element={<PropertyHubRedirect />} />
                                <Route path="/properties/:id/compliance" element={<PropertyCompliance />} />
                                {/* Static segments before :spaceId — otherwise "organise" is captured as a space id */}
                                <Route path="/properties/:id/spaces/organise/:groupSlug" element={<SpaceGroupScreen />} />
                                <Route path="/properties/:id/spaces/organise" element={<SpaceOrganisationScreen />} />
                                <Route path="/properties/:propertyId/spaces/:spaceId" element={<SpaceDetailPage />} />
                                <Route path="/properties/:id/tasks" element={<PropertyTasks />} />
                                <Route path="/properties/:id/photos" element={<PropertyPhotos />} />
                                <Route path="/properties/:id/documents" element={<PropertyDocuments />} />
                                <Route path="/properties/:id/plans" element={<PropertyBuildingPlans />} />
                                <Route path="/compliance/reviews" element={<ComplianceReviews />} />
                                <Route path="/compliance/reviews/:reviewId" element={<ReviewWorkspace />} />
                                <Route path="/compliance/reviews/:reviewId/summary" element={<ReviewSummary />} />
                                <Route path="/compliance/reviews/:reviewId/batch-rewrite" element={<BatchRewrite />} />
                                <Route path="/compliance/rules/:ruleId" element={<RuleDetail />} />
                                <Route path="/compliance/rules/:ruleId/versions" element={<RuleVersions />} />
                                <Route path="/compliance/rules/:ruleId/versions/:versionId" element={<VersionDetail />} />
                                <Route path="/compliance/rules/:ruleId/properties" element={<RuleCompliance />} />
                                <Route path="/compliance/audit" element={<AuditExport />} />
                                <Route path="/account/developer" element={<AccountDeveloper />} />
                                <Route path="/vendor/dashboard" element={<VendorDashboard />} />
                                <Route path="/vendor/tasks" element={<VendorTasks />} />
                                <Route path="/vendor/tasks/:taskId" element={<VendorTaskDetail />} />
                                <Route path="/vendor/profile" element={<VendorProfile />} />
                                <Route path="/vendor/reporting" element={<VendorReporting />} />
                                <Route
                                  path="/design-library"
                                  element={
                                    <RouteBoundary title="Design library">
                                      <DesignLibrary />
                                    </RouteBoundary>
                                  }
                                />

                                {/* Debug route — dev builds only */}
                                {isDevBuild && (
                                  <Route
                                    path="/debug/data"
                                    element={
                                      <RouteBoundary title="Debug data">
                                        <DebugData />
                                      </RouteBoundary>
                                    }
                                  />
                                )}

                                {/* 404 */}
                                <Route
                                  path="*"
                                  element={
                                    <RouteBoundary title="Page not found">
                                      <NotFound />
                                    </RouteBoundary>
                                  }
                                />
                              </Routes>
                            </Suspense>
                          </AppLayout>
                        </ProtectedRoute>
                      } />
                    </Routes>
                  </Suspense>
                  </AppInitializer>
                </DataProvider>
              </ActiveOrgProvider>
            </SystemStatusProvider>
          </BrowserRouter>
        </TooltipProvider>
      </DevModeProvider>
    </QueryClientProvider>
  );
};

export default App;
