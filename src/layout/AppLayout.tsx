import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import FooterNav from "./FooterNav";

export default function AppLayout() {
  return (
    <div className="flex flex-col h-screen bg-[#F5F3F0]">
      <AppHeader />

      <main className="flex-1 overflow-y-auto px-4 py-2">
        <Outlet />
      </main>

      <FooterNav />
    </div>
  );
}
