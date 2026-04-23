import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are MedPulse AI, a helpful assistant inside a clinic/hospital management web app called "MedPulse AI".
The app has these modules accessible via the sidebar:
- Dashboard: KPIs and charts (patients, revenue, visits, paid/unpaid)
- Patients: add/edit/delete patient records (name, age, gender, phone, address, patient code)
- Visits: doctor visit records with symptoms, diagnosis, prescription
- Lab Reports: upload/download/delete PDF or image lab reports per patient
- Payments: create bills, mark paid/unpaid, edit/delete
- Medical History: timeline view per patient
- AI Assistant (this chat)

Demo accounts: admin@demo.com/admin123 (Admin), user@demo.com/user123 (Doctor/Staff).
Only admins can grant admin role; new signups default to Doctor/Staff.

Help users with:
- How to use any feature (be concise & step-by-step)
- General medical/healthcare info (disclaim: not a substitute for professional advice)
- Suggesting clinic workflow improvements
Keep replies short and actionable. Use markdown sparingly.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, ...messages],
        stream: true,
      }),
    });

    if (response.status === 429 || response.status === 402) {
      return new Response(JSON.stringify({ error: response.status === 429 ? "Rate limit" : "Payment required" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
