import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { SystemStatusProvider } from "@/providers/SystemStatusProvider";
import { DataProvider } from "@/contexts/DataContext";
import { AppInitializer } from "@/components/AppInitializer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StatusBanner } from "@/components/ui/StatusBanner";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";

// Onboarding screens
import WelcomeScreen from "./pages/onboarding/WelcomeScreen";
import SignUpScreen from "./pages/onboarding/SignUpScreen";
import VerifyEmailScreen from "./pages/onboarding/VerifyEmailScreen";
import CreateOrganisationScreen from "./pages/onboarding/CreateOrganisationScreen";
import AddPropertyScreen from "./pages/onboarding/AddPropertyScreen";
import AddSpaceScreen from "./pages/onboarding/AddSpaceScreen";
import DesignLibrary from "./pages/DesignLibrary";
import InviteTeamScreen from "./pages/onboarding/InviteTeamScreen";
import PreferencesScreen from "./pages/onboarding/PreferencesScreen";
import OnboardingCompleteScreen from "./pages/onboarding/OnboardingCompleteScreen";

// WORK pillar
import WorkTasks from "./pages/work/WorkTasks";
import WorkInbox from "./pages/work/WorkInbox";
import WorkSchedule from "./pages/work/WorkSchedule";
import WorkAutomations from "./pages/work/WorkAutomations";

// MANAGE pillar
import ManageProperties from "./pages/manage/ManageProperties";
import ManageSpaces from "./pages/manage/ManageSpaces";
import ManagePeople from "./pages/manage/ManagePeople";
import ManageVendors from "./pages/manage/ManageVendors";
import ManageTemplates from "./pages/manage/ManageTemplates";
import ManageSettings from "./pages/manage/ManageSettings";
import Assets from "./pages/Assets";

// RECORD pillar
import RecordDocuments from "./pages/record/RecordDocuments";
import RecordCompliance from "./pages/record/RecordCompliance";
import RecordHistory from "./pages/record/RecordHistory";
import RecordReports from "./pages/record/RecordReports";
import RecordLibrary from "./pages/record/RecordLibrary";

// Legacy pages (kept for deep links)
import TaskDetail from "./pages/TaskDetail";
import AddTask from "./pages/AddTask";
import PropertyDetail from "./pages/PropertyDetail";
import PropertyCompliance from "./pages/PropertyCompliance";
import PropertyTasks from "./pages/PropertyTasks";
import PropertyPhotos from "./pages/PropertyPhotos";
import PropertyDocuments from "./pages/PropertyDocuments";
import ComplianceReviews from "./pages/ComplianceReviews";
import ReviewWorkspace from "./pages/ReviewWorkspace";
import ReviewSummary from "./pages/ReviewSummary";
import BatchRewrite from "./pages/BatchRewrite";
import RuleDetail from "./pages/RuleDetail";
import RuleVersions from "./pages/RuleVersions";
import VersionDetail from "./pages/VersionDetail";
import RuleCompliance from "./pages/RuleCompliance";
import AuditExport from "./pages/AuditExport";
import AccountDeveloper from "./pages/AccountDeveloper";
import VendorDashboard from "./pages/VendorDashboard";
import VendorTasks from "./pages/VendorTasks";
import VendorTaskDetail from "./pages/VendorTaskDetail";
import VendorProfile from "./pages/VendorProfile";
import VendorReporting from "./pages/VendorReporting";
import ManagerDashboard from "./pages/ManagerDashboard";
import Dashboard from "./app/page";
import Properties from "./pages/Properties";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import Compliance from "./pages/Compliance";
import ContractorAccess from "./pages/contractor/ContractorAccess";
import ContractorTask from "./pages/contractor/ContractorTask";

// Settings pages
import { SettingsLayout } from "./pages/settings/SettingsLayout";
import SettingsGeneral from "./pages/settings/SettingsGeneral";
import SettingsTeam from "./pages/settings/SettingsTeam";
import SettingsBilling from "./pages/settings/SettingsBilling";
import DebugData from "./pages/DebugData";

const queryClient = new QueryClient();

const App = () => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:88',message:'App component rendering',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SystemStatusProvider>
              <StatusBanner />
              <DataProvider>
                <AppInitializer>
              <Routes>
                {/* Onboarding routes (no layout) */}
                <Route path="/welcome" element={<WelcomeScreen />} />
                <Route path="/signup" element={<SignUpScreen />} />
                <Route path="/verify" element={<VerifyEmailScreen />} />
                <Route path="/onboarding/create-organisation" element={<CreateOrganisationScreen />} />
                <Route path="/onboarding/add-property" element={<AddPropertyScreen />} />
                <Route path="/onboarding/add-spaces" element={<AddSpaceScreen />} />
                <Route path="/onboarding/invite-team" element={<InviteTeamScreen />} />
                <Route path="/onboarding/preferences" element={<PreferencesScreen />} />
                <Route path="/onboarding/complete" element={<OnboardingCompleteScreen />} />
                
                {/* Login route (no layout) */}
                <Route path="/login" element={<Login />} />
                
                {/* Contractor routes (no auth required, no layout) */}
                {/* #region agent log */}
                {/* #endregion */}
                <Route path="/contractor/access" element={<ContractorAccess />} />
                <Route path="/contractor/task/:id" element={<ContractorTask />} />
                
                {/* All main app routes wrapped in AppLayout */}
                <Route path="/*" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Routes>
                        {/* Dashboard */}
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/dashboard" element={<ManagerDashboard />} />
                        
                        {/* Main Navigation */}
                        <Route path="/properties" element={<Properties />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/assets" element={<Assets />} />
                        <Route path="/calendar" element={<Calendar />} />
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
                    </AppLayout>
                  </ProtectedRoute>
                } />
              </Routes>
                  </AppInitializer>
              </DataProvider>
            </SystemStatusProvider>
          </BrowserRouter>
        </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
