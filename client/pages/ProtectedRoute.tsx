import { Navigate } from "react-router-dom";
import { getRole, getRoleHome, hasAllowedRole, hasAuthSession, type UserRole } from "@/lib/auth";

interface Props {
  children: JSX.Element;
  allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const role = getRole();

  if (!hasAuthSession()) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAllowedRole(role, allowedRoles)) {
    return <Navigate to={getRoleHome(role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
