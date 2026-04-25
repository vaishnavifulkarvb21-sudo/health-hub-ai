import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { emergencyId } = await req.json();
    if (!emergencyId) {
      return new Response(JSON.stringify({ error: "emergencyId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: emergency } = await admin.from("emergency_requests").select("*").eq("id", emergencyId).maybeSingle();
    if (!emergency) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");
    const STAFF_NUMBERS = (Deno.env.get("EMERGENCY_STAFF_NUMBERS") || "").split(",").map((s) => s.trim()).filter(Boolean);

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_FROM || STAFF_NUMBERS.length === 0) {
      return new Response(JSON.stringify({ success: false, sent: 0, reason: "Twilio not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = `🚨 MedPulse Emergency: ${emergency.patient_name} (${emergency.patient_phone || "no phone"}). ${emergency.message || ""}`.slice(0, 320);
    let sent = 0;
    for (const to of STAFF_NUMBERS) {
      try {
        const r = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
        });
        if (r.ok) sent++;
        else console.error("Twilio error:", r.status, await r.text());
      } catch (e) {
        console.error("SMS send error", e);
      }
    }
    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-emergency-sms error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
