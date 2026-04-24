import { supabase } from "@/integrations/supabase/client";

export type LogAction = "created" | "updated" | "deleted";
export type LogEntity = "patient" | "visit" | "payment" | "appointment" | "doctor" | "lab_report";

export async function logActivity(action: LogAction, entity: LogEntity, entityId?: string, details?: string) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const u = auth.user;
    if (!u) return;
    await supabase.from("activity_logs").insert({
      user_id: u.id,
      user_email: u.email ?? null,
      action,
      entity,
      entity_id: entityId ?? null,
      details: details ?? null,
    });
  } catch (e) {
    // Best-effort logging; never throw to caller.
    console.warn("logActivity failed", e);
  }
}
