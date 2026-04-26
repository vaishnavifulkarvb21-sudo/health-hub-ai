import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, Calendar as CalendarIcon, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLog";
import { format, parseISO } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  scheduled_at: string;
  status: string;
  reason: string | null;
  notes: string | null;
}
interface Patient { id: string; name: string; patient_code: string; }
interface Doctor { id: string; name: string; }

const empty = { patient_id: "", doctor_id: "", scheduled_at: new Date().toISOString().slice(0, 16), reason: "", notes: "" };

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function Appointments() {
  const perms = usePermissions();
  const [items, setItems] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const [{ data: a }, { data: p }, { data: d }] = await Promise.all([
      supabase.from("appointments").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("patients").select("id, name, patient_code").order("name"),
      supabase.from("doctors").select("id, name").order("name"),
    ]);
    setItems(a || []);
    setPatients(p || []);
    setDoctors(d || []);
  };
  useEffect(() => { load(); }, []);

  const pname = (id: string) => patients.find((x) => x.id === id)?.name || "—";
  const dname = (id: string | null) => (id ? doctors.find((x) => x.id === id)?.name || "—" : "—");

  const save = async () => {
    if (!form.patient_id) return toast.error("Select a patient");
    if (!form.scheduled_at) return toast.error("Pick a date & time");
    const { data: auth } = await supabase.auth.getUser();
    const payload = {
      patient_id: form.patient_id,
      doctor_id: form.doctor_id || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      reason: form.reason || null,
      notes: form.notes || null,
      created_by: auth.user?.id ?? null,
    };
    const { data, error } = await supabase.from("appointments").insert(payload).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Appointment scheduled");
    if (data) logActivity("created", "appointment", data.id, pname(form.patient_id));
    setOpen(false);
    setForm(empty);
    load();
  };

  const setStatus = async (a: Appointment, status: "completed" | "cancelled") => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    logActivity("updated", "appointment", a.id, `status:${status}`);
    load();
  };
  const remove = async (a: Appointment) => {
    if (!confirm("Delete this appointment?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    logActivity("deleted", "appointment", a.id);
    load();
  };

  const filtered = items.filter((a) => {
    const s = search.toLowerCase();
    const ms = !s || pname(a.patient_id).toLowerCase().includes(s) || (a.reason || "").toLowerCase().includes(s);
    const mf = filter === "all" || a.status === filter;
    return ms && mf;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><CalendarIcon className="h-7 w-7 text-primary" /> Appointments</h1>
          <p className="text-muted-foreground text-sm">{items.length} total · {items.filter((i) => i.status === "scheduled").length} upcoming</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }} className="bg-gradient-primary">
          <Plus className="h-4 w-4 mr-2" /> Schedule
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by patient or reason…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">{format(parseISO(a.scheduled_at), "PPp")}</TableCell>
                  <TableCell className="font-medium">{pname(a.patient_id)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{dname(a.doctor_id)}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{a.reason}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLES[a.status] || ""}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status === "scheduled" && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => setStatus(a, "completed")} title="Mark completed">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setStatus(a, "cancelled")} title="Cancel">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No appointments</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New appointment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Patient</Label>
              <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.patient_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Doctor</Label>
              <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Optional doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date & time</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
            <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Follow-up consultation" /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-gradient-primary">Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
