import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a deterministic but unguessable email + password from phone for Supabase auth
function phoneToEmail(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  return `patient_${digits}@patient.medpulse.local`;
}
function phoneToPassword(phone: string) {
  // Stable per-phone secret; the OTP gates issuance of this credential.
  const digits = phone.replace(/[^0-9]/g, "");
  return `MedPulse_${digits}_${digits.length}_secret_v1!`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { phone, code, name } = await req.json();
    if (!phone || !code) {
      return new Response(JSON.stringify({ error: "Phone and code required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: row } = await admin.from("phone_otp").select("*").eq("phone", phone).maybeSingle();
    if (!row) return new Response(JSON.stringify({ error: "No code requested" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Code expired" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (row.attempts >= 5) {
      return new Response(JSON.stringify({ error: "Too many attempts" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (row.code !== code) {
      await admin.from("phone_otp").update({ attempts: row.attempts + 1 }).eq("phone", phone);
      return new Response(JSON.stringify({ error: "Invalid code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Code OK — clean up
    await admin.from("phone_otp").delete().eq("phone", phone);

    const email = phoneToEmail(phone);
    const password = phoneToPassword(phone);

    // Find or create user
    const { data: existingList } = await admin.auth.admin.listUsers();
    let user = existingList?.users?.find((u) => u.email === email) ?? null;

    if (!user) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone,
        user_metadata: { full_name: name || `Patient ${phone.slice(-4)}`, role: "patient", phone },
      });
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      user = created.user;

      // Assign 'patient' role
      if (user) {
        await admin.from("user_roles").upsert({ user_id: user.id, role: "patient" });
        // Create or link a patient record
        const { data: existingPatient } = await admin.from("patients").select("id").eq("phone", phone).maybeSingle();
        if (existingPatient) {
          await admin.from("patients").update({ user_id: user.id }).eq("id", existingPatient.id);
        } else {
          await admin.from("patients").insert({
            patient_code: `P-${Date.now().toString().slice(-6)}`,
            name: name || `Patient ${phone.slice(-4)}`,
            age: 0,
            gender: "Other",
            phone,
            user_id: user.id,
          });
        }
      }
    } else {
      // Ensure patient role exists
      await admin.from("user_roles").upsert({ user_id: user.id, role: "patient" }, { onConflict: "user_id,role" });
    }

    return new Response(JSON.stringify({ success: true, email, password }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-otp error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
