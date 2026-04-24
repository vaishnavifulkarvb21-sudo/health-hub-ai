// Lightweight rule-based symptom -> probable conditions mapping.
// This is NOT medical advice and only meant to assist clinic intake.

interface Rule {
  keywords: string[];
  suggestion: string;
}

const RULES: Rule[] = [
  { keywords: ["fever", "chills", "temperature"], suggestion: "Possible viral infection / influenza. Consider CBC and hydration." },
  { keywords: ["cough", "phlegm", "sputum"], suggestion: "Possible bronchitis or upper respiratory infection." },
  { keywords: ["sore throat", "throat pain"], suggestion: "Possible pharyngitis or tonsillitis." },
  { keywords: ["headache", "migraine"], suggestion: "Possible tension headache or migraine. Check BP." },
  { keywords: ["chest pain", "tightness"], suggestion: "URGENT: rule out cardiac event — ECG recommended." },
  { keywords: ["shortness of breath", "breathless", "dyspnea"], suggestion: "Check SpO2; consider asthma, pneumonia or cardiac causes." },
  { keywords: ["abdominal pain", "stomach pain", "belly pain"], suggestion: "Consider gastritis, appendicitis, IBS — abdominal exam needed." },
  { keywords: ["diarrhea", "loose motion", "loose stool"], suggestion: "Possible gastroenteritis. Watch for dehydration." },
  { keywords: ["vomiting", "nausea"], suggestion: "Possible gastroenteritis or food poisoning." },
  { keywords: ["rash", "itching", "skin"], suggestion: "Possible allergic reaction or dermatitis." },
  { keywords: ["fatigue", "weakness", "tired"], suggestion: "Consider anemia, thyroid issues — basic blood panel suggested." },
  { keywords: ["joint pain", "arthralgia"], suggestion: "Consider arthritis, viral arthralgia or autoimmune workup." },
  { keywords: ["frequent urination", "burning urination"], suggestion: "Possible UTI — urinalysis recommended." },
  { keywords: ["dizzy", "vertigo", "lightheaded"], suggestion: "Check BP, glucose; consider BPPV." },
  { keywords: ["weight loss"], suggestion: "Investigate diabetes, hyperthyroidism, malignancy." },
];

export function suggestFromSymptoms(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matches = RULES.filter((r) => r.keywords.some((k) => lower.includes(k)));
  return matches.map((m) => m.suggestion);
}

// Outbreak detector for dashboards / lists of recent visits.
export function detectOutbreak(symptomsList: string[]): string | null {
  const counts = new Map<string, number>();
  for (const s of symptomsList) {
    if (!s) continue;
    const lower = s.toLowerCase();
    for (const r of RULES) {
      if (r.keywords.some((k) => lower.includes(k))) {
        counts.set(r.keywords[0], (counts.get(r.keywords[0]) || 0) + 1);
      }
    }
  }
  let topKey = "";
  let topCount = 0;
  counts.forEach((v, k) => {
    if (v > topCount) { topCount = v; topKey = k; }
  });
  if (topCount >= 3) {
    return `High number of ${topKey} cases detected (${topCount} in recent visits).`;
  }
  return null;
}
