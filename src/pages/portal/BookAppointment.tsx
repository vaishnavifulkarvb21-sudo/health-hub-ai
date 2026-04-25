import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { format, parseISO, addDays, isSameDay } from "date-fns";

export default function BookAppointment() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<any[]>([]);
  const [chosenSlot, setChosenSlot] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("doctors").select("id, name, specialization").order("name").then(({ data }) => setDoctors(data || []));
  }, []);

  useEffect(() => {
    if (!doctorId) { setSlots([]); return; }
    const start = new Date(date + "T00:00:00").toISOString();
    const end = new Date(date + "T23:59:59").toISOString();
    supabase
      .from("time_slots")
      .select("*")
      .eq("doctor_id", doctorId)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at")
      .then(({ data }) => setSlots(data || []));
  }, [doctorId, date]);

  // Generate default slots (9am-5pm @ 30min) if none exist for this doctor/day
  const ensureSlots = async () => {
    if (!doctorId) return;
    if (slots.length > 0) return;
    const base = new Date(date + "T09:00:00");
    const newSlots = Array.from({ length: 16 }).map((_, i) => {
      const start = new Date(base.getTime() + i * 30 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return { doctor_id: doctorId, starts_at: start.toISOString(), ends_at: end.toISOString() };
    });
    await supabase.from("time_slots").insert(newSlots);
    const { data } = await supabase
      .from("time_slots")
      .select("*")
      .eq("doctor_id", doctorId)
      .gte("starts_at", new Date(date + "T00:00:00").toISOString())
      .lte("starts_at", new Date(date + "T23:59:59").toISOString())
      .order("starts_at");
    setSlots(data || []);
  };

  useEffect(() => { ensureSlots(); /* eslint-disable-next-line */ }, [slots.length, doctorId, date]);

  const book = async () => {
    if (!doctorId) return toast.error(t("portal.book.errors.doctor"));
    if (!chosenSlot) return toast.error(t("portal.book.errors.slot"));
    setBusy(true);
    const { data: pat } = await supabase.from("patients").select("id").eq("user_id", user?.id).maybeSingle();
    if (!pat) { setBusy(false); return toast.error("Patient profile not found"); }
    const slot = slots.find((s) => s.id === chosenSlot);
    if (!slot) { setBusy(false); return; }

    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        patient_id: pat.id,
        doctor_id: doctorId,
        scheduled_at: slot.starts_at,
        reason: reason || null,
        slot_id: chosenSlot,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) { setBusy(false); return toast.error(error.message); }

    await supabase.from("time_slots").update({ is_booked: true, appointment_id: appt.id }).eq("id", chosenSlot);
    // Notify clinic staff (admins/doctors/users)
    const { data: staffRoles } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "doctor", "user"]);
    if (staffRoles) {
      const notifs = staffRoles.map((r) => ({
        user_id: r.user_id,
        title: t("portal.book.notify.title"),
        message: t("portal.book.notify.message", { date: format(parseISO(slot.starts_at), "PPp") }),
        link: "/appointments",
        type: "appointment",
      }));
      if (notifs.length) await supabase.from("notifications").insert(notifs);
    }

    setBusy(false);
    toast.success(t("portal.book.success"));
    setChosenSlot("");
    setReason("");
    // refresh slots
    const { data } = await supabase
      .from("time_slots")
      .select("*")
      .eq("doctor_id", doctorId)
      .gte("starts_at", new Date(date + "T00:00:00").toISOString())
      .lte("starts_at", new Date(date + "T23:59:59").toISOString())
      .order("starts_at");
    setSlots(data || []);
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 60), "yyyy-MM-dd");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Calendar className="h-7 w-7 text-primary" /> {t("portal.book.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("portal.book.subtitle")}</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>{t("portal.book.doctor")}</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger><SelectValue placeholder={t("portal.book.selectDoctor")} /></SelectTrigger>
              <SelectContent>
                {doctors.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No doctors yet</div>}
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.specialization ? ` · ${d.specialization}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("portal.book.date")}</Label>
            <Input type="date" min={today} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>{t("portal.book.slots")}</Label>
          {!doctorId ? (
            <p className="text-sm text-muted-foreground py-3">{t("portal.book.selectDoctorFirst")}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">{t("portal.book.noSlots")}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {slots.map((s) => {
                const taken = s.is_booked;
                const selected = s.id === chosenSlot;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={taken}
                    onClick={() => setChosenSlot(s.id)}
                    className={`px-2 py-2 rounded-md text-sm border transition-smooth ${
                      taken
                        ? "bg-muted text-muted-foreground line-through cursor-not-allowed border-border"
                        : selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    }`}
                  >
                    {format(parseISO(s.starts_at), "p")}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <Label>{t("portal.book.reason")}</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("portal.book.reasonPlaceholder")} rows={3} />
        </div>

        <Button onClick={book} disabled={busy || !chosenSlot} className="w-full bg-gradient-primary">
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t("portal.book.confirm")}
        </Button>
      </Card>
    </div>
  );
}
