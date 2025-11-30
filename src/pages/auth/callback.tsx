import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const type = searchParams.get("type");

  useEffect(() => {
    if (type === "recovery" && token) {
      window.location.href = `/reset-password?access_token=${token}`;
    } else {
      window.location.href = "/login";
    }
  }, [token, type]);

  return <div className="p-6 text-center">Redirecting…</div>;
}
