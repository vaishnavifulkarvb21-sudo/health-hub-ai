import { useState } from "react";
import { AlertTriangle, Phone, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const EMERGENCY_PHONE = "+911234567890"; // clinic emergency line — user can edit

export function EmergencyButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });

  // Try to prefill from logged-in patient record
  const openModal = async () => {
    setOpen(true);
    if (!user) return;
    const { data } = await supabase.from("patients").select("name, phone").eq("user_id", user.id).maybeSingle();
    if (data) setForm((f) => ({ ...f, name: data.name || f.name, phone: data.phone || f.phone }));
  };

  const submit = async () => {
    if (!form.name) return toast.error("Please enter your name");
    setBusy(true);
    let patientId: string | null = null;
    if (user) {
      const { data } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      patientId = data?.id ?? null;
    }
    const { data: emergency, error } = await supabase
      .from("emergency_requests")
      .insert({
        patient_id: patientId,
        patient_name: form.name,
        patient_phone: form.phone || null,
        user_id: user?.id ?? null,
        message: form.message || null,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);

    toast.success("🚨 Emergency alert sent — help is on the way");
    // Best-effort SMS to staff (if Twilio configured)
    if (emergency?.id) {
      supabase.functions.invoke("send-emergency-sms", { body: { emergencyId: emergency.id } }).catch(() => {});
    }
    setOpen(false);
    setForm({ name: "", phone: "", message: "" });
  };

  return (
    <>
      <button
        onClick={openModal}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-destructive text-destructive-foreground shadow-2xl hover:scale-110 transition-transform flex items-center justify-center animate-pulse hover:animate-none focus:outline-none focus:ring-4 focus:ring-destructive/40"
        aria-label="Emergency Help"
        title="Emergency Help"
      >
        <AlertTriangle className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Emergency Help
            </DialogTitle>
            <DialogDescription>
              Send a real-time alert to our medical team. For life-threatening emergencies, please also call directly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <a
              href={`tel:${EMERGENCY_PHONE}`}
              className="flex items-center justify-center gap-2 w-full p-3 rounded-lg bg-destructive/10 text-destructive font-semibold hover:bg-destructive/20 transition-smooth"
            >
              <Phone className="h-4 w-4" /> Call {EMERGENCY_PHONE}
            </a>
            <div>
              <Label>Your name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" />
            </div>
            <div>
              <Label>What's happening?</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Briefly describe the emergency"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
