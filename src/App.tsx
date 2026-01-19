import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useRoutes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { SystemStatusProvider } from "@/providers/SystemStatusProvider";
import { ActiveOrgProvider } from "@/providers/ActiveOrgProvider";
import { DataProvider } from "@/contexts/DataContext";
import { ScheduleProvider } from "@/contexts/ScheduleContext";
import { AppInitializer } from "@/components/AppInitializer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { LoadingState } from "@/components/design-system/LoadingState";
import { publicRoutes, appRoutes } from "@/routes/routes";

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

function AppShellRoutes() {
  return useRoutes(appRoutes);
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SystemStatusProvider>
              <StatusBanner />
              <ScheduleProvider>
                <DataProvider>
                  <ActiveOrgProvider>
                    <AppInitializer>
                    <Suspense fallback={<LoadingState message="Loading..." />}>
                      <Routes>
                        {publicRoutes.map((r) => (
                          <Route key={r.path} path={r.path} element={r.element} />
                        ))}
                        
                        {/* All main app routes wrapped in AppLayout */}
                        <Route path="/*" element={
                          <ProtectedRoute>
                            <AppLayout>
                              <Suspense fallback={<LoadingState message="Loading page..." />}>
                                <AppShellRoutes />
                              </Suspense>
                            </AppLayout>
                          </ProtectedRoute>
                        } />
                      </Routes>
                    </Suspense>
                    </AppInitializer>
                  </ActiveOrgProvider>
                </DataProvider>
              </ScheduleProvider>
            </SystemStatusProvider>
          </BrowserRouter>
        </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
