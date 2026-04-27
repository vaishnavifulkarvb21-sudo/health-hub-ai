import { useEffect, useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Loader2, Stethoscope, Clock, CheckCircle2, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { format, parseISO, addDays, isToday, isPast, startOfDay } from "date-fns";
import { Link, useNavigate } from "react-router-dom";

interface Doctor {
  id: string;
  name: string;
  specialization: string | null;
  contact: string | null;
  email: string | null;
}
interface Slot {
  id: string;
  starts_at: string;
  ends_at: string;
  is_booked: boolean;
  doctor_id: string;
}

const VISIT_TYPES = [
  { value: "consultation", label: "Consultation", duration: 30 },
  { value: "followup", label: "Follow-up", duration: 20 },
  { value: "checkup", label: "Routine check-up", duration: 30 },
  { value: "vaccination", label: "Vaccination", duration: 15 },
  { value: "other", label: "Other", duration: 30 },
];

export default function BookAppointment() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [chosenSlot, setChosenSlot] = useState<string>("");
  const [visitType, setVisitType] = useState("consultation");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirmation, setConfirmation] = useState<{ slot: Slot; doctor?: Doctor } | null>(null);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const maxDate = useMemo(() => format(addDays(new Date(), 60), "yyyy-MM-dd"), []);

  // Quick date strip — next 7 days
  const dateStrip = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const d = addDays(new Date(), i);
        return { date: format(d, "yyyy-MM-dd"), label: format(d, "EEE"), day: format(d, "d") };
      }),
    [],
  );

  useEffect(() => {
    supabase
      .from("doctors")
      .select("id, name, specialization, contact, email")
      .order("name")
      .then(({ data }) => setDoctors(data || []));
  }, []);

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  const fetchSlots = useCallback(async () => {
    if (!doctorId) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    const start = new Date(date + "T00:00:00").toISOString();
    const end = new Date(date + "T23:59:59").toISOString();
    const { data } = await supabase
      .from("time_slots")
      .select("*")
      .eq("doctor_id", doctorId)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at");
    setSlots((data || []) as Slot[]);
    setLoadingSlots(false);
    setChosenSlot("");
  }, [doctorId, date]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Generate default slots once if none exist for that doctor/day (and date isn't past)
  useEffect(() => {
    if (loadingSlots || !doctorId) return;
    if (slots.length > 0) return;
    if (isPast(startOfDay(new Date(date + "T00:00:00"))) && !isToday(new Date(date + "T00:00:00"))) return;

    let cancelled = false;
    (async () => {
      // Re-check (avoids race / duplicate inserts)
      const start = new Date(date + "T00:00:00").toISOString();
      const end = new Date(date + "T23:59:59").toISOString();
      const { data: existing } = await supabase
        .from("time_slots")
        .select("id")
        .eq("doctor_id", doctorId)
        .gte("starts_at", start)
        .lte("starts_at", end)
        .limit(1);
      if (cancelled || (existing && existing.length > 0)) {
        if (existing && existing.length > 0) fetchSlots();
        return;
      }
      const base = new Date(date + "T09:00:00");
      const newSlots = Array.from({ length: 16 }).map((_, i) => {
        const s = new Date(base.getTime() + i * 30 * 60 * 1000);
        const e = new Date(s.getTime() + 30 * 60 * 1000);
        return { doctor_id: doctorId, starts_at: s.toISOString(), ends_at: e.toISOString() };
      });
      await supabase.from("time_slots").insert(newSlots);
      if (!cancelled) fetchSlots();
    })();
    return () => {
      cancelled = true;
    };
  }, [slots.length, doctorId, date, loadingSlots, fetchSlots]);

  const visibleSlots = useMemo(() => {
    const now = Date.now();
    return slots.filter((s) => new Date(s.starts_at).getTime() > now);
  }, [slots]);

  const availableCount = visibleSlots.filter((s) => !s.is_booked).length;

  const book = async () => {
    if (!doctorId) return toast.error("Please select a doctor");
    if (!chosenSlot) return toast.error("Please choose a time slot");
    setBusy(true);

    const { data: pat } = await supabase.from("patients").select("id").eq("user_id", user?.id).maybeSingle();
    if (!pat) {
      setBusy(false);
      return toast.error("Patient profile not found. Please contact support.");
    }

    const slot = slots.find((s) => s.id === chosenSlot);
    if (!slot) {
      setBusy(false);
      return;
    }

    // Re-check slot availability to prevent double-booking
    const { data: fresh } = await supabase.from("time_slots").select("is_booked").eq("id", chosenSlot).maybeSingle();
    if (fresh?.is_booked) {
      setBusy(false);
      toast.error("This slot was just booked. Please pick another.");
      fetchSlots();
      return;
    }

    const reasonText = reason
      ? `${VISIT_TYPES.find((v) => v.value === visitType)?.label}: ${reason}`
      : VISIT_TYPES.find((v) => v.value === visitType)?.label || null;

    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        patient_id: pat.id,
        doctor_id: doctorId,
        scheduled_at: slot.starts_at,
        reason: reasonText,
        slot_id: chosenSlot,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }

    await supabase.from("time_slots").update({ is_booked: true, appointment_id: appt.id }).eq("id", chosenSlot);

    // Notify clinic staff
    const { data: staffRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "doctor", "user"]);
    if (staffRoles?.length) {
      const notifs = staffRoles.map((r) => ({
        user_id: r.user_id,
        title: "New appointment booked",
        message: `${selectedDoctor?.name || "Doctor"} · ${format(parseISO(slot.starts_at), "PPp")}`,
        link: "/appointments",
        type: "appointment",
      }));
      await supabase.from("notifications").insert(notifs);
    }

    setBusy(false);
    setConfirmation({ slot, doctor: selectedDoctor });
    setChosenSlot("");
    setReason("");
    fetchSlots();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-7 w-7 text-primary" /> Book Appointment
        </h1>
        <p className="text-muted-foreground text-sm">Choose a doctor, date, and a free time slot.</p>
      </div>

      {/* Step 1: Doctor */}
      <Card className="p-5 space-y-4">
        <div>
          <Label className="text-sm font-semibold">1. Select Doctor</Label>
          {doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No doctors available yet. Please check back later.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {doctors.map((d) => {
                const active = d.id === doctorId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDoctorId(d.id)}
                    className={`text-left p-3 rounded-lg border transition-smooth flex items-start gap-3 ${
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {d.specialization || "General Physician"}
                      </div>
                      {d.contact && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {d.contact}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 2: Date */}
        <div>
          <Label className="text-sm font-semibold">2. Pick a Date</Label>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const prev = addDays(new Date(date + "T00:00:00"), -1);
                if (prev >= startOfDay(new Date())) setDate(format(prev, "yyyy-MM-dd"));
              }}
              disabled={date <= today}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex gap-1.5 overflow-x-auto flex-1 py-1">
              {dateStrip.map((d) => {
                const active = d.date === date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setDate(d.date)}
                    className={`shrink-0 w-14 py-2 rounded-lg border text-center transition-smooth ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="text-[10px] uppercase opacity-80">{d.label}</div>
                    <div className="text-lg font-bold leading-tight">{d.day}</div>
                  </button>
                );
              })}
            </div>
            <Input
              type="date"
              min={today}
              max={maxDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        {/* Step 3: Slot */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">3. Choose Time Slot</Label>
            {doctorId && !loadingSlots && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                <Clock className="h-3 w-3 mr-1" /> {availableCount} available
              </Badge>
            )}
          </div>
          {!doctorId ? (
            <p className="text-sm text-muted-foreground py-3">Select a doctor first.</p>
          ) : loadingSlots ? (
            <div className="py-6 flex items-center justify-center text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
            </div>
          ) : visibleSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">
              No upcoming slots for this date. Try another day.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-2">
              {visibleSlots.map((s) => {
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
                        ? "bg-primary text-primary-foreground border-primary shadow-elegant"
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

        {/* Step 4: Visit details */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-semibold">4. Visit Type</Label>
            <Select value={visitType} onValueChange={setVisitType}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIT_TYPES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label} <span className="text-muted-foreground text-xs">· {v.duration}m</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-semibold">Reason / symptoms (optional)</Label>
            <Textarea
              className="mt-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Persistent headache for 3 days"
              rows={2}
            />
          </div>
        </div>

        {/* Summary + confirm */}
        {chosenSlot && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
            <div className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Booking summary
            </div>
            <div className="text-muted-foreground">
              <b className="text-foreground">{selectedDoctor?.name}</b>
              {selectedDoctor?.specialization && ` · ${selectedDoctor.specialization}`}
            </div>
            <div className="text-muted-foreground">
              {format(parseISO(slots.find((s) => s.id === chosenSlot)!.starts_at), "PPPP 'at' p")}
            </div>
          </div>
        )}

        <Button onClick={book} disabled={busy || !chosenSlot} className="w-full bg-gradient-primary">
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirm Booking
        </Button>
      </Card>

      {/* Confirmation modal */}
      <Dialog open={!!confirmation} onOpenChange={(o) => !o && setConfirmation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" /> Appointment Confirmed
            </DialogTitle>
          </DialogHeader>
          {confirmation && (
            <div className="space-y-2 text-sm">
              <div>
                Your appointment with <b>{confirmation.doctor?.name || "the doctor"}</b> has been booked.
              </div>
              <div className="rounded-md bg-muted p-3">
                <div className="text-xs text-muted-foreground">Date & time</div>
                <div className="font-semibold">{format(parseISO(confirmation.slot.starts_at), "PPPP 'at' p")}</div>
              </div>
              <p className="text-xs text-muted-foreground">
                You'll receive a notification reminder. You can also cancel or reschedule from "My Appointments".
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmation(null)}>Book another</Button>
            <Button onClick={() => navigate("/portal/appointments")} className="bg-gradient-primary">
              View my appointments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
