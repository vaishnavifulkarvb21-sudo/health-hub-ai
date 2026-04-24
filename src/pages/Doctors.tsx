import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Stethoscope, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLog";
import { exportCsv } from "@/lib/exportCsv";

interface Doctor { id: string; name: string; specialization: string | null; contact: string | null; email: string | null; }

const empty = { name: "", specialization: "", contact: "", email: "" };

export default function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [{ data: docs }, { data: pats }] = await Promise.all([
      supabase.from("doctors").select("*").order("name"),
      supabase.from("patients").select("doctor_id"),
    ]);
    setDoctors(docs || []);
    const map: Record<string, number> = {};
    (pats || []).forEach((p: { doctor_id: string | null }) => {
      if (p.doctor_id) map[p.doctor_id] = (map[p.doctor_id] || 0) + 1;
    });
    setCounts(map);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const payload = { ...form, name: form.name.trim() };
    if (editing) {
      const { error } = await supabase.from("doctors").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Doctor updated");
      logActivity("updated", "doctor", editing.id, payload.name);
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("doctors").insert({ ...payload, created_by: auth.user?.id ?? null }).select("id").single();
      if (error) return toast.error(error.message);
      toast.success("Doctor added");
      if (data) logActivity("created", "doctor", data.id, payload.name);
    }
    setOpen(false);
    setForm(empty);
    setEditing(null);
    load();
  };

  const remove = async (d: Doctor) => {
    if (!confirm(`Delete ${d.name}?`)) return;
    const { error } = await supabase.from("doctors").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Doctor deleted");
    logActivity("deleted", "doctor", d.id, d.name);
    load();
  };

  const filtered = doctors.filter((d) => {
    const s = search.toLowerCase();
    return !s || d.name.toLowerCase().includes(s) || (d.specialization || "").toLowerCase().includes(s);
  });

  const handleExport = () => {
    exportCsv("doctors", filtered.map((d) => ({
      name: d.name,
      specialization: d.specialization,
      contact: d.contact,
      email: d.email,
      patient_count: counts[d.id] || 0,
    })));
    toast.success("Exported CSV");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Stethoscope className="h-7 w-7 text-primary" /> Doctors</h1>
          <p className="text-muted-foreground text-sm">{doctors.length} doctors on staff</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>Export CSV</Button>
          <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-2" /> Add doctor
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or specialization…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Patients</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.specialization}</TableCell>
                  <TableCell>{d.contact}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{d.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Users className="h-3 w-3" /> {counts[d.id] || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setForm({ name: d.name, specialization: d.specialization || "", contact: d.contact || "", email: d.email || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No doctors yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit doctor" : "New doctor"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. Anita Sharma" /></div>
            <div><Label>Specialization</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Cardiologist" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="+91 …" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
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
