import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

// Lazy load pages
const NotFound = lazy(() => import("@/pages/NotFound"));
const Login = lazy(() => import("@/pages/Login"));

// Onboarding
const WelcomeScreen = lazy(() => import("@/pages/onboarding/WelcomeScreen"));
const SignUpScreen = lazy(() => import("@/pages/onboarding/SignUpScreen"));
const VerifyEmailScreen = lazy(() => import("@/pages/onboarding/VerifyEmailScreen"));
const AcceptInvitation = lazy(() => import("@/pages/AcceptInvitation"));
const CreateOrganisationScreen = lazy(() => import("@/pages/onboarding/CreateOrganisationScreen"));
const AddPropertyScreen = lazy(() => import("@/pages/onboarding/AddPropertyScreen"));
const AddSpaceScreen = lazy(() => import("@/pages/onboarding/AddSpaceScreen"));
const InviteTeamScreen = lazy(() => import("@/pages/onboarding/InviteTeamScreen"));
const PreferencesScreen = lazy(() => import("@/pages/onboarding/PreferencesScreen"));
const OnboardingCompleteScreen = lazy(() => import("@/pages/onboarding/OnboardingCompleteScreen"));

// Contractor
const ContractorAccess = lazy(() => import("@/pages/contractor/ContractorAccess"));
const ContractorTask = lazy(() => import("@/pages/contractor/ContractorTask"));

// Main
const Dashboard = lazy(() => import("@/app/page"));
const ManagerDashboard = lazy(() => import("@/pages/ManagerDashboard"));
const Properties = lazy(() => import("@/pages/Properties"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Assets = lazy(() => import("@/pages/Assets"));
const Compliance = lazy(() => import("@/pages/Compliance"));

// WORK pillar
const WorkTasks = lazy(() => import("@/pages/work/WorkTasks"));
const WorkInbox = lazy(() => import("@/pages/work/WorkInbox"));
const WorkSchedule = lazy(() => import("@/pages/work/WorkSchedule"));
const WorkAutomations = lazy(() => import("@/pages/work/WorkAutomations"));

// MANAGE pillar
const ManageProperties = lazy(() => import("@/pages/manage/ManageProperties"));
const ManageSpaces = lazy(() => import("@/pages/manage/ManageSpaces"));
const ManagePeople = lazy(() => import("@/pages/manage/ManagePeople"));
const ManageVendors = lazy(() => import("@/pages/manage/ManageVendors"));
const ManageTemplates = lazy(() => import("@/pages/manage/ManageTemplates"));
const ManageSettings = lazy(() => import("@/pages/manage/ManageSettings"));

// RECORD pillar
const RecordDocuments = lazy(() => import("@/pages/record/RecordDocuments"));
const RecordCompliance = lazy(() => import("@/pages/record/RecordCompliance"));
const RecordHistory = lazy(() => import("@/pages/record/RecordHistory"));
const RecordReports = lazy(() => import("@/pages/record/RecordReports"));
const RecordLibrary = lazy(() => import("@/pages/record/RecordLibrary"));

// Legacy / deep links
const TaskDetail = lazy(() => import("@/pages/TaskDetail"));
const AddTask = lazy(() => import("@/pages/AddTask"));
const PropertyDetail = lazy(() => import("@/pages/PropertyDetail"));
const PropertyCompliance = lazy(() => import("@/pages/PropertyCompliance"));
const PropertyTasks = lazy(() => import("@/pages/PropertyTasks"));
const PropertyPhotos = lazy(() => import("@/pages/PropertyPhotos"));
const PropertyDocuments = lazy(() => import("@/pages/PropertyDocuments"));
const ComplianceReviews = lazy(() => import("@/pages/ComplianceReviews"));
const ReviewWorkspace = lazy(() => import("@/pages/ReviewWorkspace"));
const ReviewSummary = lazy(() => import("@/pages/ReviewSummary"));
const BatchRewrite = lazy(() => import("@/pages/BatchRewrite"));
const RuleDetail = lazy(() => import("@/pages/RuleDetail"));
const RuleVersions = lazy(() => import("@/pages/RuleVersions"));
const VersionDetail = lazy(() => import("@/pages/VersionDetail"));
const RuleCompliance = lazy(() => import("@/pages/RuleCompliance"));
const AuditExport = lazy(() => import("@/pages/AuditExport"));
const AccountDeveloper = lazy(() => import("@/pages/AccountDeveloper"));
const VendorDashboard = lazy(() => import("@/pages/VendorDashboard"));
const VendorTasks = lazy(() => import("@/pages/VendorTasks"));
const VendorTaskDetail = lazy(() => import("@/pages/VendorTaskDetail"));
const VendorProfile = lazy(() => import("@/pages/VendorProfile"));
const VendorReporting = lazy(() => import("@/pages/VendorReporting"));
const DesignLibrary = lazy(() => import("@/pages/DesignLibrary"));
const DebugData = lazy(() => import("@/pages/DebugData"));

// Settings
const SettingsLayout = lazy(() =>
  import("@/pages/settings/SettingsLayout").then((module) => ({ default: module.SettingsLayout }))
);
const SettingsGeneral = lazy(() => import("@/pages/settings/SettingsGeneral"));
const SettingsTeam = lazy(() => import("@/pages/settings/SettingsTeam"));
const SettingsBilling = lazy(() => import("@/pages/settings/SettingsBilling"));

export const publicRoutes: RouteObject[] = [
  { path: "/welcome", element: <WelcomeScreen /> },
  { path: "/signup", element: <SignUpScreen /> },
  { path: "/verify", element: <VerifyEmailScreen /> },
  { path: "/accept-invitation", element: <AcceptInvitation /> },
  { path: "/onboarding/create-organisation", element: <CreateOrganisationScreen /> },
  { path: "/onboarding/add-property", element: <AddPropertyScreen /> },
  { path: "/onboarding/add-spaces", element: <AddSpaceScreen /> },
  { path: "/onboarding/invite-team", element: <InviteTeamScreen /> },
  { path: "/onboarding/preferences", element: <PreferencesScreen /> },
  { path: "/onboarding/complete", element: <OnboardingCompleteScreen /> },
  { path: "/login", element: <Login /> },
  { path: "/contractor/access", element: <ContractorAccess /> },
  { path: "/contractor/task/:id", element: <ContractorTask /> },
];

export const appRoutes: RouteObject[] = [
  { path: "/", element: <Dashboard /> },
  { path: "/dashboard", element: <ManagerDashboard /> },

  // Main Navigation
  { path: "/properties", element: <Properties /> },
  { path: "/tasks", element: <Tasks /> },
  { path: "/schedule", element: <Schedule /> },
  { path: "/assets", element: <Assets /> }, // single canonical /assets
  { path: "/compliance", element: <Compliance /> },

  // WORK pillar
  { path: "/work/tasks", element: <WorkTasks /> },
  { path: "/work/inbox", element: <WorkInbox /> },
  { path: "/work/schedule", element: <WorkSchedule /> },
  { path: "/work/automations", element: <WorkAutomations /> },

  // MANAGE pillar
  { path: "/manage/properties", element: <ManageProperties /> },
  { path: "/manage/spaces", element: <ManageSpaces /> },
  { path: "/manage/people", element: <ManagePeople /> },
  { path: "/manage/vendors", element: <ManageVendors /> },
  { path: "/manage/templates", element: <ManageTemplates /> },
  { path: "/manage/settings", element: <ManageSettings /> },

  // Settings
  {
    path: "/settings",
    element: <SettingsLayout />,
    children: [
      { index: true, element: <SettingsGeneral /> },
      { path: "team", element: <SettingsTeam /> },
      { path: "billing", element: <SettingsBilling /> },
    ],
  },

  // RECORD pillar
  { path: "/record/documents", element: <RecordDocuments /> },
  { path: "/record/compliance", element: <RecordCompliance /> },
  { path: "/record/history", element: <RecordHistory /> },
  { path: "/record/reports", element: <RecordReports /> },
  { path: "/record/library", element: <RecordLibrary /> },

  // Legacy/deep-link routes
  { path: "/task/:id", element: <TaskDetail /> },
  { path: "/add-task", element: <AddTask /> },
  { path: "/properties/:id", element: <PropertyDetail /> },
  { path: "/properties/:id/compliance", element: <PropertyCompliance /> },
  { path: "/properties/:id/tasks", element: <PropertyTasks /> },
  { path: "/properties/:id/photos", element: <PropertyPhotos /> },
  { path: "/properties/:id/documents", element: <PropertyDocuments /> },
  { path: "/compliance/reviews", element: <ComplianceReviews /> },
  { path: "/compliance/reviews/:reviewId", element: <ReviewWorkspace /> },
  { path: "/compliance/reviews/:reviewId/summary", element: <ReviewSummary /> },
  { path: "/compliance/reviews/:reviewId/batch-rewrite", element: <BatchRewrite /> },
  { path: "/compliance/rules/:ruleId", element: <RuleDetail /> },
  { path: "/compliance/rules/:ruleId/versions", element: <RuleVersions /> },
  { path: "/compliance/rules/:ruleId/versions/:versionId", element: <VersionDetail /> },
  { path: "/compliance/rules/:ruleId/properties", element: <RuleCompliance /> },
  { path: "/compliance/audit", element: <AuditExport /> },
  { path: "/account/developer", element: <AccountDeveloper /> },
  { path: "/vendor/dashboard", element: <VendorDashboard /> },
  { path: "/vendor/tasks", element: <VendorTasks /> },
  { path: "/vendor/tasks/:taskId", element: <VendorTaskDetail /> },
  { path: "/vendor/profile", element: <VendorProfile /> },
  { path: "/vendor/reporting", element: <VendorReporting /> },
  { path: "/design-library", element: <DesignLibrary /> },

  // Debug
  { path: "/debug/data", element: <DebugData /> },

  // 404 (inside app shell)
  { path: "*", element: <NotFound /> },
];

