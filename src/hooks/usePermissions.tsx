import { useAuth } from "@/hooks/useAuth";

/**
 * Centralized permission helpers.
 * Roles in the database: 'admin' | 'user' (legacy: clinic staff/doctor) | 'doctor' | 'staff' | 'patient'
 *
 * For backwards compatibility, anyone with role 'user' is treated as full clinic staff
 * (same access as before this upgrade). New signups can be promoted to 'doctor', 'staff' or 'admin'.
 */
export function usePermissions() {
  const { role } = useAuth();
  const r = role as string | null;

  const isAdmin = r === "admin";
  const isDoctor = r === "doctor";
  const isStaff = r === "staff";
  const isPatient = r === "patient";
  const isLegacyUser = r === "user"; // existing clinic accounts
  const isClinicSide = isAdmin || isDoctor || isStaff || isLegacyUser;

  return {
    role: r,
    isAdmin,
    isDoctor,
    isStaff,
    isPatient,
    isLegacyUser,
    isClinicSide,
    // CRUD permissions (UI gating; RLS enforces server-side)
    canDeletePatient: isAdmin,
    canDeleteVisit: isAdmin || isDoctor || isLegacyUser,
    canDeletePayment: isAdmin || isLegacyUser,
    canDeleteReport: isAdmin || isDoctor || isLegacyUser,
    canEditPatient: isAdmin || isDoctor || isStaff || isLegacyUser,
    canCreatePatient: isAdmin || isStaff || isLegacyUser,
    canManageDoctors: isAdmin || isLegacyUser,
    canViewActivityLog: isAdmin,
    canHandleEmergency: isAdmin || isDoctor || isLegacyUser,
    canMarkReportReady: isAdmin || isDoctor || isLegacyUser,
    canCreateAppointment: isAdmin || isDoctor || isStaff || isLegacyUser,
    canEditPayment: isAdmin || isLegacyUser,
  };
}
