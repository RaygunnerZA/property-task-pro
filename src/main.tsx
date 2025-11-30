import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Expose supabase for console debugging
if (import.meta.env.DEV) {
  // @ts-ignore
  window.supabase = supabase;
}
