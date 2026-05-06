import { Navigate, useLocation } from "react-router-dom";
import { isAuthed } from "@/lib/auth";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
