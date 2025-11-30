import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Not logged in
        navigate("/welcome");
        return;
      }

      // Check if user has organisation (onboarding complete)
      const { data: memberData } = await supabase
        .from('organisation_members')
        .select('org_id')
        .eq('user_id', session.user.id)
        .single();

      if (!memberData?.org_id) {
        // Logged in but no organisation - needs onboarding
        navigate("/onboarding/create-organisation");
      } else {
        // Fully onboarded
        navigate("/work/tasks");
      }
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F4F2]">
      <div className="text-center">
        <p className="text-xl text-[#6D7480]">Loading...</p>
      </div>
    </div>
  );
};

export default Index;
