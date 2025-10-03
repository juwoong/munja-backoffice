import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
