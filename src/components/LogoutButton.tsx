import { supabase } from '@/integrations/supabase/client';

export default function LogoutButton() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button onClick={handleLogout}>Log out</button>
  );
}
