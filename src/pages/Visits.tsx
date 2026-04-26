import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, FileDown, Sparkles, Loader2, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLog";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import { suggestFromSymptoms } from "@/lib/symptomRules";
import { usePermissions } from "@/hooks/usePermissions";

interface Visit { id: string; patient_id: string; visit_date: string; symptoms: string | null; diagnosis: string | null; prescription: string | null; doctor_name: string | null; }
interface Patient { id: string; name: string; patient_code: string; age: number; phone: string | null; address: string | null; }

const empty = { patient_id: "", visit_date: new Date().toISOString().slice(0, 10), symptoms: "", diagnosis: "", prescription: "", doctor_name: "" };

export default function Visits() {
  const perms = usePermissions();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = async () => {
    const [{ data: v }, { data: p }] = await Promise.all([
      supabase.from("visits").select("*").order("visit_date", { ascending: false }),
      supabase.from("patients").select("id, name, patient_code, age, phone, address").order("name"),
    ]);
    setVisits(v || []);
    setPatients(p || []);
  };
  useEffect(() => { load(); }, []);

  const findPatient = (id: string) => patients.find((x) => x.id === id);
  const pname = (id: string) => findPatient(id)?.name || "—";

  const ruleHints = suggestFromSymptoms(form.symptoms);

  const save = async () => {
    if (!form.patient_id) return toast.error("Select a patient");
    if (editing) {
      const { error } = await supabase.from("visits").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Visit updated");
      logActivity("updated", "visit", editing.id, pname(form.patient_id));
    } else {
      const { data, error } = await supabase.from("visits").insert(form).select("id").single();
      if (error) return toast.error(error.message);
      toast.success("Visit added");
      if (data) logActivity("created", "visit", data.id, pname(form.patient_id));
    }
    setOpen(false); setAiSuggestion(""); load();
  };
  const remove = async (v: Visit) => {
    if (!confirm("Delete this visit?")) return;
    const { error } = await supabase.from("visits").delete().eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    logActivity("deleted", "visit", v.id);
    load();
  };

  const askAI = async () => {
    if (!form.symptoms.trim()) return toast.error("Enter symptoms first");
    setAiLoading(true);
    setAiSuggestion("");
    try {
      const pat = findPatient(form.patient_id);
      const { data, error } = await supabase.functions.invoke("ai-symptom", {
        body: { symptoms: form.symptoms, age: pat?.age, gender: undefined },
      });
      if (error) throw error;
      setAiSuggestion(data?.suggestion || "No suggestion produced.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("AI error: " + msg);
    } finally {
      setAiLoading(false);
    }
  };

  const downloadVisitInvoice = (v: Visit) => {
    const pat = findPatient(v.patient_id);
    if (!pat) return toast.error("Patient not found");
    downloadInvoicePdf({
      invoiceNumber: v.id.slice(0, 8).toUpperCase(),
      date: v.visit_date,
      patient: { name: pat.name, code: pat.patient_code, phone: pat.phone, address: pat.address },
      doctor: v.doctor_name,
      lines: [{ description: `Consultation${v.diagnosis ? ` — ${v.diagnosis}` : ""}`, amount: 500 }],
      notes: v.prescription || undefined,
    });
    toast.success("Invoice downloaded");
  };

  const filtered = visits.filter((v) => {
    const s = search.toLowerCase();
    return !s || pname(v.patient_id).toLowerCase().includes(s) || (v.diagnosis || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Doctor Visits</h1>
          <p className="text-muted-foreground text-sm">{visits.length} total visit records</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(empty); setAiSuggestion(""); setOpen(true); }} className="bg-gradient-primary">
          <Plus className="h-4 w-4 mr-2" /> New visit
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by patient name or diagnosis…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead className="hidden md:table-cell">Doctor</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id} className="hover:bg-accent/40 transition-smooth">
                  <TableCell>{v.visit_date}</TableCell>
                  <TableCell className="font-medium">{pname(v.patient_id)}</TableCell>
                  <TableCell className="max-w-xs truncate">{v.diagnosis}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{v.doctor_name}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => downloadVisitInvoice(v)} title="Invoice"><FileDown className="h-4 w-4 text-primary" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(v); setForm({ patient_id: v.patient_id, visit_date: v.visit_date, symptoms: v.symptoms || "", diagnosis: v.diagnosis || "", prescription: v.prescription || "", doctor_name: v.doctor_name || "" }); setAiSuggestion(""); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    {perms.canDeleteVisit && (
                      <Button variant="ghost" size="icon" onClick={() => remove(v)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No visits</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit visit" : "New visit"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Patient</Label>
              <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.patient_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} /></div>
              <div><Label>Doctor</Label><Input value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })} /></div>
            </div>
            <div>
              <Label>Symptoms</Label>
              <Textarea rows={2} value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} />
              {ruleHints.length > 0 && (
                <div className="mt-2 p-2.5 rounded-md bg-accent/60 border border-accent text-xs space-y-1 animate-fade-in">
                  <div className="flex items-center gap-1 font-semibold text-accent-foreground">
                    <Lightbulb className="h-3 w-3" /> Quick hints
                  </div>
                  {ruleHints.map((h, i) => <div key={i} className="text-muted-foreground">• {h}</div>)}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={askAI} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Ask AI for deeper analysis
              </Button>
              {aiSuggestion && (
                <div className="mt-2 p-3 rounded-md bg-primary/5 border border-primary/30 text-xs whitespace-pre-wrap animate-fade-in">
                  {aiSuggestion}
                </div>
              )}
            </div>
            <div><Label>Diagnosis</Label><Textarea rows={2} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
            <div><Label>Prescription</Label><Textarea rows={2} value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-gradient-primary">{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
