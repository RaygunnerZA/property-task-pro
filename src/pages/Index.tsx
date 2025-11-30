import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('filla_onboarding_complete');
    
    if (isLoggedIn) {
      navigate("/work/tasks");
    } else {
      navigate("/welcome");
    }
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
