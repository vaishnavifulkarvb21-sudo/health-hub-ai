import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Stethoscope, XCircle, RefreshCw, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, parseISO, isPast } from "date-fns";

interface Appt {
  id: string;
  scheduled_at: string;
  status: string;
  reason: string | null;
  doctor_id: string | null;
  slot_id: string | null;
}
interface Doctor { id: string; name: string; specialization: string | null }

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function MyAppointments() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [confirmCancel, setConfirmCancel] = useState<Appt | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: p } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
    if (!p) { setLoading(false); return; }
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from("appointments").select("*").eq("patient_id", p.id).order("scheduled_at", { ascending: false }),
      supabase.from("doctors").select("id, name, specialization"),
    ]);
    setAppts((a as Appt[]) || []);
    setDoctors((d as Doctor[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const dname = (id: string | null) => doctors.find((x) => x.id === id);

  const cancel = async (a: Appt) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", a.id);
    if (error) return toast.error(error.message);
    if (a.slot_id) {
      await supabase.from("time_slots").update({ is_booked: false, appointment_id: null }).eq("id", a.slot_id);
    }
    // Notify clinic
    const { data: staffRoles } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "doctor", "user"]);
    if (staffRoles?.length) {
      await supabase.from("notifications").insert(staffRoles.map((r) => ({
        user_id: r.user_id,
        title: "Appointment cancelled",
        message: `Patient cancelled the ${format(parseISO(a.scheduled_at), "PPp")} slot`,
        link: "/appointments",
        type: "appointment",
      })));
    }
    toast.success("Appointment cancelled");
    setConfirmCancel(null);
    load();
  };

  const filtered = appts.filter((a) => {
    const past = isPast(parseISO(a.scheduled_at));
    if (filter === "upcoming") return !past && a.status === "scheduled";
    if (filter === "past") return past || a.status !== "scheduled";
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-7 w-7 text-primary" /> My Appointments
          </h1>
          <p className="text-muted-foreground text-sm">Manage your bookings — cancel or reschedule anytime.</p>
        </div>
        <Link to="/portal/book">
          <Button className="bg-gradient-primary"><Calendar className="h-4 w-4 mr-2" /> Book new</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {(["upcoming", "past", "all"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card className="p-10 text-center text-muted-foreground">Loading…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          {filter === "upcoming" ? "No upcoming appointments. Book one now!" : "Nothing here."}
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((a) => {
            const doc = dname(a.doctor_id);
            const past = isPast(parseISO(a.scheduled_at));
            const canCancel = a.status === "scheduled" && !past;
            return (
              <Card key={a.id} className="p-4 hover:shadow-elegant transition-smooth">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium leading-tight">{doc?.name || "Doctor"}</div>
                      <div className="text-xs text-muted-foreground">{doc?.specialization || "General"}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className={STATUS_STYLE[a.status] || ""}>{a.status}</Badge>
                </div>
                <div className="text-sm flex items-center gap-2 mt-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {format(parseISO(a.scheduled_at), "PPp")}
                </div>
                {a.reason && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.reason}</div>}
                {canCancel && (
                  <div className="flex gap-2 mt-3">
                    <Link to="/portal/book" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reschedule
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="flex-1 text-destructive hover:bg-destructive/10" onClick={() => setConfirmCancel(a)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                )}
                {a.status === "completed" && (
                  <div className="text-xs text-success mt-3 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Visit completed
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel appointment?</DialogTitle></DialogHeader>
          {confirmCancel && (
            <div className="text-sm text-muted-foreground">
              You're about to cancel your appointment on{" "}
              <b className="text-foreground">{format(parseISO(confirmCancel.scheduled_at), "PPp")}</b>. This frees the slot for others.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(null)}>Keep it</Button>
            <Button variant="destructive" onClick={() => confirmCancel && cancel(confirmCancel)}>Yes, cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
