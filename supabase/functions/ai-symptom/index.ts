import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a medical-triage assistant for a clinic intake form.
Given symptoms typed by clinic staff, respond with:
1. 2-4 likely differential diagnoses (most-to-least likely).
2. Recommended quick tests or examinations.
3. A clear urgency tag: ROUTINE, SOON, or URGENT.
Always end with a one-line disclaimer that final diagnosis is up to the attending physician.
Keep the response under 180 words. Use plain text with short bullet points.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { symptoms, age, gender } = await req.json();
    if (!symptoms || typeof symptoms !== "string" || symptoms.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid symptoms" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Patient: age ${age ?? "?"}, gender ${gender ?? "?"}.\nReported symptoms: ${symptoms}`;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
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
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await response.json();
    const suggestion = data?.choices?.[0]?.message?.content ?? "No suggestion produced.";
    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-symptom error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
