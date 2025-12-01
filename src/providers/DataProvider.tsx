// Re-export from unified DataContext for backward compatibility
// This file maintains existing import paths while using the new context system

export { DataProvider, useDataContext, useAuth, useOrg, useCurrentUser } from "@/contexts/DataContext";
