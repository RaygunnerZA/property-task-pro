import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Schedule from "./pages/Schedule";
import Properties from "./pages/Properties";
import AddTask from "./pages/AddTask";
import ComplianceReviews from "./pages/ComplianceReviews";
import ReviewWorkspace from "./pages/ReviewWorkspace";
import ReviewSummary from "./pages/ReviewSummary";
import ComplianceProperties from "./pages/ComplianceProperties";
import RuleCompliance from "./pages/RuleCompliance";
import PropertyCompliance from "./pages/PropertyCompliance";
import RuleDetail from "./pages/RuleDetail";
import RuleVersions from "./pages/RuleVersions";
import VersionDetail from "./pages/VersionDetail";
import ComplianceTasks from "./pages/ComplianceTasks";
import PropertyTasks from "./pages/PropertyTasks";
import BatchRewrite from "./pages/BatchRewrite";
import ComplianceDashboard from "./pages/ComplianceDashboard";
import AuditExport from "./pages/AuditExport";
import NotFound from "./pages/NotFound";
import VendorDashboard from "./pages/VendorDashboard";
import VendorTasks from "./pages/VendorTasks";
import VendorTaskDetail from "./pages/VendorTaskDetail";
import VendorProfile from "./pages/VendorProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Tasks />} />
          <Route path="/task/:id" element={<TaskDetail />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id/compliance" element={<PropertyCompliance />} />
          <Route path="/add-task" element={<AddTask />} />
          <Route path="/compliance/dashboard" element={<ComplianceDashboard />} />
          <Route path="/compliance/audit" element={<AuditExport />} />
          <Route path="/compliance/reviews" element={<ComplianceReviews />} />
          <Route path="/compliance/reviews/:reviewId" element={<ReviewWorkspace />} />
          <Route path="/compliance/reviews/:reviewId/summary" element={<ReviewSummary />} />
          <Route path="/compliance/reviews/:reviewId/batch-rewrite" element={<BatchRewrite />} />
          <Route path="/compliance/properties" element={<ComplianceProperties />} />
          <Route path="/compliance/rules/:ruleId" element={<RuleDetail />} />
          <Route path="/compliance/rules/:ruleId/versions" element={<RuleVersions />} />
          <Route path="/compliance/rules/:ruleId/versions/:versionId" element={<VersionDetail />} />
          <Route path="/compliance/rules/:ruleId/properties" element={<RuleCompliance />} />
          <Route path="/tasks/compliance" element={<ComplianceTasks />} />
          <Route path="/properties/:id/tasks" element={<PropertyTasks />} />
          <Route path="/vendor/dashboard" element={<VendorDashboard />} />
          <Route path="/vendor/tasks" element={<VendorTasks />} />
          <Route path="/vendor/tasks/:taskId" element={<VendorTaskDetail />} />
          <Route path="/vendor/profile" element={<VendorProfile />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
