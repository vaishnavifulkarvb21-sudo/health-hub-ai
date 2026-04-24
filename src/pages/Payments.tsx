import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, CheckCircle2, FileDown, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLog";
import { exportCsv } from "@/lib/exportCsv";
import { downloadInvoicePdf } from "@/lib/invoicePdf";

interface Payment { id: string; patient_id: string; amount: number; description: string | null; status: string; bill_date: string; }
interface Patient { id: string; name: string; patient_code: string; phone: string | null; address: string | null; }

const empty = { patient_id: "", amount: 0, description: "", status: "unpaid", bill_date: new Date().toISOString().slice(0, 10) };

export default function Payments() {
  const [items, setItems] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const [{ data: p }, { data: ps }] = await Promise.all([
      supabase.from("payments").select("*").order("bill_date", { ascending: false }),
      supabase.from("patients").select("id, name, patient_code, phone, address").order("name"),
    ]);
    setItems(p || []);
    setPatients(ps || []);
  };
  useEffect(() => { load(); }, []);
  const findPatient = (id: string) => patients.find((x) => x.id === id);
  const pname = (id: string) => findPatient(id)?.name || "—";

  const save = async () => {
    if (!form.patient_id || !form.amount) return toast.error("Patient & amount required");
    if (editing) {
      const { error } = await supabase.from("payments").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Updated");
      logActivity("updated", "payment", editing.id, `₹${form.amount}`);
    } else {
      const { data, error } = await supabase.from("payments").insert(form).select("id").single();
      if (error) return toast.error(error.message);
      toast.success("Bill created");
      if (data) logActivity("created", "payment", data.id, `₹${form.amount} for ${pname(form.patient_id)}`);
    }
    setOpen(false); load();
  };
  const remove = async (p: Payment) => {
    if (!confirm("Delete this payment record?")) return;
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    logActivity("deleted", "payment", p.id);
    load();
  };
  const togglePaid = async (p: Payment) => {
    const newStatus = p.status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("payments").update({ status: newStatus }).eq("id", p.id);
    if (error) return toast.error(error.message);
    logActivity("updated", "payment", p.id, `marked ${newStatus}`);
    load();
  };

  const downloadInvoice = (p: Payment) => {
    const pat = findPatient(p.patient_id);
    if (!pat) return toast.error("Patient not found");
    downloadInvoicePdf({
      invoiceNumber: p.id.slice(0, 8).toUpperCase(),
      date: p.bill_date,
      patient: { name: pat.name, code: pat.patient_code, phone: pat.phone, address: pat.address },
      lines: [{ description: p.description || "Medical services", amount: Number(p.amount) }],
      status: p.status,
    });
    toast.success("Invoice downloaded");
  };

  const filtered = items.filter((p) => {
    const s = search.toLowerCase();
    const ms = !s || pname(p.patient_id).toLowerCase().includes(s) || (p.description || "").toLowerCase().includes(s);
    const mf = filter === "all" || p.status === filter;
    return ms && mf;
  });

  const totalPaid = items.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalUnpaid = items.filter((i) => i.status === "unpaid").reduce((s, i) => s + Number(i.amount), 0);

  const handleExport = () => {
    exportCsv("payments", filtered.map((p) => ({
      bill_date: p.bill_date,
      patient: pname(p.patient_id),
      description: p.description,
      amount: p.amount,
      status: p.status,
    })));
    toast.success("Payments exported");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Payments & Billing</h1>
          <p className="text-muted-foreground text-sm">Paid: ₹{totalPaid.toLocaleString()} · Unpaid: ₹{totalUnpaid.toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
          <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-2" /> New bill
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-accent/40 transition-smooth">
                  <TableCell>{p.bill_date}</TableCell>
                  <TableCell className="font-medium">{pname(p.patient_id)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.description}</TableCell>
                  <TableCell className="text-right font-medium">₹{Number(p.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "paid" ? "default" : "destructive"} className={p.status === "paid" ? "bg-success" : ""}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => downloadInvoice(p)} title="Download invoice"><FileDown className="h-4 w-4 text-primary" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => togglePaid(p)} title="Toggle paid"><CheckCircle2 className="h-4 w-4 text-success" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setForm({ patient_id: p.patient_id, amount: Number(p.amount), description: p.description || "", status: p.status, bill_date: p.bill_date }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No payments</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit bill" : "New bill"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Patient</Label>
              <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (₹)</Label><Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div><Label>Date</Label><Input type="date" value={form.bill_date} onChange={(e) => setForm({ ...form, bill_date: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-gradient-primary">{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
