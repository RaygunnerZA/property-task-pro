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
import NotFound from "./pages/NotFound";

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
          <Route path="/add-task" element={<AddTask />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
