import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { SystemStatusProvider } from "@/providers/SystemStatusProvider";
import { DataProvider } from "@/contexts/DataContext";
import { AppInitializer } from "@/components/AppInitializer";
import { AuthHashHandler } from "@/components/AuthHashHandler";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { LoadingState } from "@/components/design-system/LoadingState";
import Login from "@/pages/Login";

// Lazy load all page components (except Login and AppLayout which load instantly)
const NotFound = lazy(() => import("./pages/NotFound"));

// Onboarding screens
const WelcomeScreen = lazy(() => import("./pages/onboarding/WelcomeScreen"));
const SignUpScreen = lazy(() => import("./pages/onboarding/SignUpScreen"));
const VerifyEmailScreen = lazy(() => import("./pages/onboarding/VerifyEmailScreen"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const CreateOrganisationScreen = lazy(() => import("./pages/onboarding/CreateOrganisationScreen"));
const StaffOnboardingScreen = lazy(() => import("./pages/onboarding/StaffOnboardingScreen"));
const AddPropertyScreen = lazy(() => import("./pages/onboarding/AddPropertyScreen"));
const AddSpaceScreen = lazy(() => import("./pages/onboarding/AddSpaceScreen"));
const DesignLibrary = lazy(() => import("./pages/DesignLibrary"));
const InviteTeamScreen = lazy(() => import("./pages/onboarding/InviteTeamScreen"));
const PreferencesScreen = lazy(() => import("./pages/onboarding/PreferencesScreen"));
const OnboardingCompleteScreen = lazy(() => import("./pages/onboarding/OnboardingCompleteScreen"));

// WORK pillar
const WorkTasks = lazy(() => import("./pages/work/WorkTasks"));
const WorkInbox = lazy(() => import("./pages/work/WorkInbox"));
const WorkSchedule = lazy(() => import("./pages/work/WorkSchedule"));
const WorkAutomations = lazy(() => import("./pages/work/WorkAutomations"));

// MANAGE pillar
const ManageProperties = lazy(() => import("./pages/manage/ManageProperties"));
const ManageSpaces = lazy(() => import("./pages/manage/ManageSpaces"));
const ManagePeople = lazy(() => import("./pages/manage/ManagePeople"));
const ManageVendors = lazy(() => import("./pages/manage/ManageVendors"));
const ManageTemplates = lazy(() => import("./pages/manage/ManageTemplates"));
const ManageSettings = lazy(() => import("./pages/manage/ManageSettings"));
const Assets = lazy(() => import("./pages/Assets"));

// RECORD pillar
const RecordDocuments = lazy(() => import("./pages/record/RecordDocuments"));
const RecordCompliance = lazy(() => import("./pages/record/RecordCompliance"));
const RecordHistory = lazy(() => import("./pages/record/RecordHistory"));
const RecordReports = lazy(() => import("./pages/record/RecordReports"));
const RecordLibrary = lazy(() => import("./pages/record/RecordLibrary"));

// Legacy pages (kept for deep links)
const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const AddTask = lazy(() => import("./pages/AddTask"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const PropertyCompliance = lazy(() => import("./pages/PropertyCompliance"));
const PropertyTasks = lazy(() => import("./pages/PropertyTasks"));
const PropertyPhotos = lazy(() => import("./pages/PropertyPhotos"));
const PropertyDocuments = lazy(() => import("./pages/PropertyDocuments"));
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
const Compliance = lazy(() => import("./pages/Compliance"));
const ContractorAccess = lazy(() => import("./pages/contractor/ContractorAccess"));
const ContractorTask = lazy(() => import("./pages/contractor/ContractorTask"));

// Settings pages
const SettingsLayout = lazy(() => import("./pages/settings/SettingsLayout").then(module => ({ default: module.SettingsLayout })));
const SettingsGeneral = lazy(() => import("./pages/settings/SettingsGeneral"));
const SettingsTeam = lazy(() => import("./pages/settings/SettingsTeam"));
const SettingsBilling = lazy(() => import("./pages/settings/SettingsBilling"));
const DebugData = lazy(() => import("./pages/DebugData"));

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

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthHashHandler />
            <SystemStatusProvider>
              <StatusBanner />
              <DataProvider>
                <AppInitializer>
                  <Suspense fallback={<LoadingState message="Loading..." />}>
                    <Routes>
                      {/* Onboarding routes (no layout) */}
                      <Route path="/welcome" element={<WelcomeScreen />} />
                      <Route path="/signup" element={<SignUpScreen />} />
                      <Route path="/verify" element={<VerifyEmailScreen />} />
                      <Route path="/accept-invitation" element={<AcceptInvitation />} />
                      <Route path="/onboarding/create-organisation" element={<CreateOrganisationScreen />} />
                      <Route path="/onboarding/staff" element={<StaffOnboardingScreen />} />
                      <Route path="/onboarding/add-property" element={<AddPropertyScreen />} />
                      <Route path="/onboarding/add-spaces" element={<AddSpaceScreen />} />
                      <Route path="/onboarding/invite-team" element={<InviteTeamScreen />} />
                      <Route path="/onboarding/preferences" element={<PreferencesScreen />} />
                      <Route path="/onboarding/complete" element={<OnboardingCompleteScreen />} />
                      
                      {/* Login route (no layout) */}
                      <Route path="/login" element={<Login />} />
                      
                      {/* Contractor routes (no auth required, no layout) */}
                      <Route path="/contractor/access" element={<ContractorAccess />} />
                      <Route path="/contractor/task/:id" element={<ContractorTask />} />
                      
                      {/* All main app routes wrapped in AppLayout */}
                      <Route path="/*" element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Suspense fallback={<LoadingState message="Loading page..." />}>
                              <Routes>
                                {/* Dashboard */}
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/dashboard" element={<ManagerDashboard />} />
                                
                                {/* Main Navigation */}
                                <Route path="/properties" element={<Properties />} />
                                <Route path="/tasks" element={<Tasks />} />
                                <Route path="/schedule" element={<Schedule />} />
                                <Route path="/assets" element={<Assets />} />
                                <Route path="/compliance" element={<Compliance />} />
                                
                                {/* WORK pillar */}
                                <Route path="/work/tasks" element={<WorkTasks />} />
                                <Route path="/work/inbox" element={<WorkInbox />} />
                                <Route path="/work/schedule" element={<WorkSchedule />} />
                                <Route path="/work/automations" element={<WorkAutomations />} />
                                
                                {/* MANAGE pillar */}
                                <Route path="/manage/properties" element={<ManageProperties />} />
                                <Route path="/manage/spaces" element={<ManageSpaces />} />
                                <Route path="/assets" element={<Assets />} />
                                <Route path="/manage/people" element={<ManagePeople />} />
                                <Route path="/manage/vendors" element={<ManageVendors />} />
                                <Route path="/manage/templates" element={<ManageTemplates />} />
                                <Route path="/manage/settings" element={<ManageSettings />} />
                                
                                {/* Settings routes */}
                                <Route path="/settings" element={<SettingsLayout />}>
                                  <Route index element={<SettingsGeneral />} />
                                  <Route path="team" element={<SettingsTeam />} />
                                  <Route path="billing" element={<SettingsBilling />} />
                                </Route>
                                
                                {/* RECORD pillar */}
                                <Route path="/record/documents" element={<RecordDocuments />} />
                                <Route path="/record/compliance" element={<RecordCompliance />} />
                                <Route path="/record/history" element={<RecordHistory />} />
                                <Route path="/record/reports" element={<RecordReports />} />
                                <Route path="/record/library" element={<RecordLibrary />} />
                                
                                {/* Legacy/deep-link routes */}
                                <Route path="/task/:id" element={<TaskDetail />} />
                                <Route path="/add-task" element={<AddTask />} />
                                <Route path="/properties/:id" element={<PropertyDetail />} />
                                <Route path="/properties/:id/compliance" element={<PropertyCompliance />} />
                                <Route path="/properties/:id/tasks" element={<PropertyTasks />} />
                                <Route path="/properties/:id/photos" element={<PropertyPhotos />} />
                                <Route path="/properties/:id/documents" element={<PropertyDocuments />} />
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
                                <Route path="/design-library" element={<DesignLibrary />} />
                                
                                {/* Debug route */}
                                <Route path="/debug/data" element={<DebugData />} />
                                
                                {/* 404 */}
                                <Route path="*" element={<NotFound />} />
                              </Routes>
                            </Suspense>
                          </AppLayout>
                        </ProtectedRoute>
                      } />
                    </Routes>
                  </Suspense>
                </AppInitializer>
              </DataProvider>
            </SystemStatusProvider>
          </BrowserRouter>
        </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
