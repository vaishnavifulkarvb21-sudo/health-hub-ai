import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, Save, Loader2, Mail, Phone, IdCard, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function PatientProfile() {
  const { user } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", age: "", gender: "male", phone: "", email: "", address: "", disease: "" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("patients").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setPatient(data);
        setForm({
          name: data.name || "",
          age: String(data.age ?? ""),
          gender: data.gender || "male",
          phone: data.phone || "",
          email: data.email || user.email || "",
          address: data.address || "",
          disease: data.disease || "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!patient) return;
    if (!form.name.trim()) return toast.error("Name is required");
    const ageN = parseInt(form.age);
    if (!ageN || ageN < 0 || ageN > 130) return toast.error("Enter a valid age");
    setSaving(true);
    const { error } = await supabase.from("patients").update({
      name: form.name.trim(),
      age: ageN,
      gender: form.gender,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      disease: form.disease || null,
    }).eq("id", patient.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  if (loading) return <Card className="p-10 text-center text-muted-foreground">Loading…</Card>;
  if (!patient) return <Card className="p-10 text-center text-muted-foreground">No patient profile linked.</Card>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <User className="h-7 w-7 text-primary" /> My Profile
        </h1>
        <p className="text-muted-foreground text-sm">Keep your details up to date for accurate care.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-16 w-16 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
            {form.name.charAt(0).toUpperCase() || "P"}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-lg truncate">{form.name || "Patient"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
              <Badge variant="outline" className="font-mono"><IdCard className="h-3 w-3 mr-1" /> {patient.patient_code}</Badge>
              {form.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {form.email}</span>}
              {form.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {form.phone}</span>}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Full name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Age</Label>
            <Input type="number" min={0} max={130} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
          </div>
          <div>
            <Label>Gender</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" />
          </div>
          <div className="sm:col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="flex items-center gap-1"><Heart className="h-3 w-3 text-destructive" /> Known conditions / allergies</Label>
            <Textarea
              rows={2}
              value={form.disease}
              onChange={(e) => setForm({ ...form, disease: e.target.value })}
              placeholder="e.g. Diabetes, Penicillin allergy"
            />
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="mt-4 bg-gradient-primary">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save changes
        </Button>
      </Card>
    </div>
  );
}
