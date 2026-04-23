import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const data = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are an analytics assistant for a healthcare clinic dashboard.
Given these stats, write a brief (max 6 short bullet points) actionable summary covering:
- Notable trends in revenue & visits
- Paid vs unpaid bill ratio (collection health)
- Patient demographics observation
- One basic predictive insight (e.g. expected revenue next 7 days based on the trend)
- One concrete recommendation

Data:
${JSON.stringify(data, null, 2)}

Be concise, friendly, and specific with numbers. Use plain text bullets ("• ").`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (r.status === 429 || r.status === 402) {
      return new Response(JSON.stringify({ error: r.status === 429 ? "Rate limit" : "Payment required" }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!r.ok) {
      const t = await r.text();
      console.error("insights error:", r.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const j = await r.json();
    const insight = j.choices?.[0]?.message?.content || "No insight available.";
    return new Response(JSON.stringify({ insight }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
