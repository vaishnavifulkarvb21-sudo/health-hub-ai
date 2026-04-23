import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, Receipt, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Patient { id: string; name: string; patient_code: string; age: number; gender: string; }
interface TimelineItem { type: "visit" | "payment" | "report"; date: string; title: string; subtitle: string; meta?: string; }

export default function History() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [items, setItems] = useState<TimelineItem[]>([]);

  useEffect(() => {
    supabase.from("patients").select("*").order("name").then(({ data }) => {
      setPatients(data || []);
      if (data && data.length && !selected) setSelected(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const [{ data: v }, { data: p }, { data: r }] = await Promise.all([
        supabase.from("visits").select("*").eq("patient_id", selected),
        supabase.from("payments").select("*").eq("patient_id", selected),
        supabase.from("lab_reports").select("*").eq("patient_id", selected),
      ]);
      const all: TimelineItem[] = [
        ...(v || []).map((x) => ({ type: "visit" as const, date: x.visit_date, title: x.diagnosis || "Visit", subtitle: x.symptoms || "", meta: x.doctor_name || "" })),
        ...(p || []).map((x) => ({ type: "payment" as const, date: x.bill_date, title: `${x.description || "Bill"} — ₹${Number(x.amount).toLocaleString()}`, subtitle: "", meta: x.status })),
        ...(r || []).map((x) => ({ type: "report" as const, date: x.created_at.slice(0, 10), title: x.title, subtitle: "Lab report", meta: "" })),
      ].sort((a, b) => b.date.localeCompare(a.date));
      setItems(all);
    })();
  }, [selected]);

  const patient = patients.find((p) => p.id === selected);

  const icon = (t: TimelineItem["type"]) => t === "visit" ? <Stethoscope className="h-4 w-4" /> : t === "payment" ? <Receipt className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />;
  const accent = (t: TimelineItem["type"]) => t === "visit" ? "bg-primary/10 text-primary" : t === "payment" ? "bg-warning/10 text-warning" : "bg-accent text-accent-foreground";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Medical History</h1>
        <p className="text-muted-foreground text-sm">Complete patient timeline across visits, payments and reports</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="min-w-[260px]">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.patient_code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {patient && (
            <div className="text-sm text-muted-foreground">
              {patient.age} y · {patient.gender} · {patient.patient_code}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        {items.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No history yet</div>
        ) : (
          <div className="relative pl-6 border-l-2 border-border space-y-5">
            {items.map((it, i) => (
              <div key={i} className="relative">
                <div className={`absolute -left-[34px] h-8 w-8 rounded-full flex items-center justify-center ${accent(it.type)}`}>{icon(it.type)}</div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{it.title}</div>
                    {it.subtitle && <div className="text-sm text-muted-foreground">{it.subtitle}</div>}
                    {it.meta && <div className="text-xs text-muted-foreground mt-1">{it.meta}</div>}
                  </div>
                  <Badge variant="outline">{it.date}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
