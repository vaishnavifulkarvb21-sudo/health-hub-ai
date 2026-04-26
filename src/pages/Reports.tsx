import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, Trash2, FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLog";
import { exportCsv } from "@/lib/exportCsv";
import { usePermissions } from "@/hooks/usePermissions";

interface Report { id: string; patient_id: string; title: string; file_path: string; file_type: string | null; created_at: string; }
interface Patient { id: string; name: string; patient_code: string; }

export default function Reports() {
  const perms = usePermissions();
  const [reports, setReports] = useState<Report[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ patient_id: "", title: "", file: null as File | null });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("lab_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("patients").select("id, name, patient_code").order("name"),
    ]);
    setReports(r || []);
    setPatients(p || []);
  };
  useEffect(() => { load(); }, []);
  const pname = (id: string) => patients.find((x) => x.id === id)?.name || "—";

  const upload = async () => {
    if (!form.patient_id || !form.title || !form.file) return toast.error("All fields required");
    setBusy(true);
    const ext = form.file.name.split(".").pop();
    const path = `${form.patient_id}/${Date.now()}.${ext}`;
    const [{ data: auth }, { error: upErr }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.storage.from("lab-reports").upload(path, form.file),
    ]);
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { error } = await supabase.from("lab_reports").insert({
      patient_id: form.patient_id,
      title: form.title,
      file_path: path,
      file_type: form.file.type,
      created_by: auth.user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Report uploaded");
    logActivity("created", "lab_report", undefined, form.title);
    setOpen(false); setForm({ patient_id: "", title: "", file: null }); load();
  };

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("lab-reports").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Failed to get download link");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (r: Report) => {
    if (!confirm("Delete this report?")) return;
    const { data, error } = await supabase.from("lab_reports").delete().eq("id", r.id).select("id");
    if (error) return toast.error(error.message);
    if (!data?.length) return toast.error("You do not have permission to delete this report.");

    const { error: storageError } = await supabase.storage.from("lab-reports").remove([r.file_path]);
    if (storageError) toast.error("Report record deleted, but file cleanup failed.");
    else toast.success("Deleted");
    logActivity("deleted", "lab_report", r.id, r.title);

    load();
  };

  const handleExport = () => {
    exportCsv("lab_reports", reports.map((r) => ({
      title: r.title,
      patient: pname(r.patient_id),
      file_type: r.file_type,
      uploaded_on: new Date(r.created_at).toLocaleDateString(),
    })));
    toast.success("Reports exported");
  };

  const filtered = reports.filter((r) => {
    const s = search.toLowerCase();
    return !s || r.title.toLowerCase().includes(s) || pname(r.patient_id).toLowerCase().includes(s);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Lab & Pathology Reports</h1>
          <p className="text-muted-foreground text-sm">{reports.length} reports uploaded</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-gradient-primary"><Upload className="h-4 w-4 mr-2" /> Upload report</Button>
      </div>
      <div className="flex justify-end -mt-2">
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search reports…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4 bg-gradient-card hover:shadow-elegant transition-smooth">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{pname(r.patient_id)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => download(r.file_path)}><Download className="h-3 w-3 mr-1" /> Open</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-12">No reports yet</div>}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload lab report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Patient</Label>
              <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.patient_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Report title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Complete Blood Count" /></div>
            <div><Label>File (PDF or image)</Label><Input type="file" accept=".pdf,image/*" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={upload} className="bg-gradient-primary" disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
