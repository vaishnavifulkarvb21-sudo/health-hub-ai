import { useAuth } from "@/hooks/useAuth";

/**
 * Simplified two-role permission model:
 *   - "admin"   → full clinic access (manages everything)
 *   - "patient" → patient portal only
 *
 * Legacy DB roles ("user", "doctor", "staff") are treated as admin-equivalent
 * so existing accounts keep working without a data migration.
 */
export function usePermissions() {
  const { role } = useAuth();
  const r = role as string | null;

  const isPatient = r === "patient";
  // Anyone who isn't a patient (and is logged in) is treated as clinic admin.
  const isAdmin = !!r && r !== "patient";

  // Back-compat aliases used by older components.
  const isDoctor = isAdmin;
  const isStaff = isAdmin;
  const isLegacyUser = isAdmin;
  const isClinicSide = isAdmin;

  return {
    role: r,
    // Display label for the badge in the header.
    displayRole: isPatient ? "Patient" : isAdmin ? "Admin" : "Guest",

    isAdmin,
    isPatient,
    // Legacy flags – kept so existing imports continue to compile.
    isDoctor,
    isStaff,
    isLegacyUser,
    isClinicSide,

    // CRUD permissions (UI gating; RLS enforces server-side)
    canDeletePatient: isAdmin,
    canDeleteVisit: isAdmin,
    canDeletePayment: isAdmin,
    canDeleteReport: isAdmin,
    canEditPatient: isAdmin,
    canCreatePatient: isAdmin,
    canManageDoctors: isAdmin,
    canViewActivityLog: isAdmin,
    canHandleEmergency: isAdmin,
    canMarkReportReady: isAdmin,
    canCreateAppointment: isAdmin,
    canEditPayment: isAdmin,
  };
}
