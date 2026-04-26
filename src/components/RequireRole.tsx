import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type Role = "admin" | "doctor" | "staff" | "patient" | "user";

interface Props {
  allow: Role[];
  children: ReactNode;
  /** If a patient hits a clinic page, send them to /portal instead of showing Access Denied. */
  redirectPatientToPortal?: boolean;
}

/**
 * Server-side enforcement is done via RLS. This component is a UX guard so users
 * never reach pages whose data they cannot read.
 */
export const RequireRole = ({ allow, children, redirectPatientToPortal = true }: Props) => {
  const { role, loading, user } = useAuth();
  if (loading) {
    return <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const r = (role ?? "user") as Role;
  if (allow.includes(r)) return <>{children}</>;

  if (r === "patient" && redirectPatientToPortal) {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground text-sm">
          Your role ({r}) doesn't have permission to view this page.
        </p>
        <Button asChild>
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
};
