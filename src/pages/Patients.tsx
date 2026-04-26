import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLog";
import { exportCsv } from "@/lib/exportCsv";
import { usePermissions } from "@/hooks/usePermissions";

interface Patient {
  id: string;
  patient_code: string;
  name: string;
  age: number;
  gender: string;
  phone: string | null;
  address: string | null;
  disease: string | null;
  doctor_id: string | null;
  created_at: string;
}

interface DoctorLite { id: string; name: string; }

const empty = { patient_code: "", name: "", age: 0, gender: "Male", phone: "", address: "", disease: "", doctor_id: "" };

export default function Patients() {
  const perms = usePermissions();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<DoctorLite[]>([]);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [diseaseFilter, setDiseaseFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const [{ data: p, error }, { data: d }] = await Promise.all([
      supabase.from("patients").select("*").order("created_at", { ascending: false }),
      supabase.from("doctors").select("id, name").order("name"),
    ]);
    if (error) toast.error(error.message);
    else setPatients((p || []) as Patient[]);
    setDoctors(d || []);
  };

  useEffect(() => { load(); }, []);

  const dname = (id: string | null) => (id ? doctors.find((x) => x.id === id)?.name || "—" : "—");

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, patient_code: `P-${Date.now().toString().slice(-5)}` });
    setOpen(true);
  };
  const openEdit = (p: Patient) => {
    setEditing(p);
    setForm({
      patient_code: p.patient_code,
      name: p.name,
      age: p.age,
      gender: p.gender,
      phone: p.phone || "",
      address: p.address || "",
      disease: p.disease || "",
      doctor_id: p.doctor_id || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.patient_code || !form.age) return toast.error("Name, code and age are required");
    const payload = { ...form, age: Number(form.age), doctor_id: form.doctor_id || null };
    if (editing) {
      const { error } = await supabase.from("patients").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Patient updated");
      logActivity("updated", "patient", editing.id, form.name);
    } else {
      const { data, error } = await supabase.from("patients").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      toast.success("Patient added");
      if (data) logActivity("created", "patient", data.id, form.name);
    }
    setOpen(false);
    load();
  };

  const remove = async (p: Patient) => {
    if (!confirm("Delete this patient and all related records?")) return;
    const { error } = await supabase.from("patients").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Patient deleted");
    logActivity("deleted", "patient", p.id, p.name);
    load();
  };

  const filtered = patients.filter((p) => {
    const s = search.toLowerCase();
    const matchSearch = !s
      || p.name.toLowerCase().includes(s)
      || p.patient_code.toLowerCase().includes(s)
      || (p.phone || "").includes(s);
    const matchGender = genderFilter === "all" || p.gender === genderFilter;
    const matchDisease = !diseaseFilter || (p.disease || "").toLowerCase().includes(diseaseFilter.toLowerCase());
    const created = p.created_at.slice(0, 10);
    const matchFrom = !dateFrom || created >= dateFrom;
    const matchTo = !dateTo || created <= dateTo;
    return matchSearch && matchGender && matchDisease && matchFrom && matchTo;
  });

  const handleExport = () => {
    exportCsv("patients", filtered.map((p) => ({
      patient_code: p.patient_code,
      name: p.name,
      age: p.age,
      gender: p.gender,
      phone: p.phone,
      address: p.address,
      disease: p.disease,
      doctor: dname(p.doctor_id),
      registered_on: p.created_at.slice(0, 10),
    })));
    toast.success("Patients exported");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Patients</h1>
          <p className="text-muted-foreground text-sm">{patients.length} total · manage records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
          <Button onClick={openNew} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" /> Add patient</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div className="relative lg:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name, code or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genders</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Filter by disease…" value={diseaseFilter} onChange={(e) => setDiseaseFilter(e.target.value)} />
          <div className="flex gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden md:table-cell">Disease</TableHead>
                <TableHead className="hidden lg:table-cell">Doctor</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-accent/40 transition-smooth">
                  <TableCell className="font-mono text-xs">{p.patient_code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.age}</TableCell>
                  <TableCell>{p.gender}</TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.disease}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{dname(p.doctor_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No patients found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit patient" : "New patient"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Patient ID</Label><Input value={form.patient_code} onChange={(e) => setForm({ ...form, patient_code: e.target.value })} /></div>
            <div><Label>Age</Label><Input type="number" value={form.age || ""} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Disease / Condition</Label><Input value={form.disease} onChange={(e) => setForm({ ...form, disease: e.target.value })} placeholder="e.g. Hypertension" /></div>
            <div>
              <Label>Assigned doctor</Label>
              <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
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
