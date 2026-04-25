import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Emergency {
  id: string;
  patient_name: string;
  patient_phone: string | null;
  message: string | null;
  status: string;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Pending", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
  in_progress: { label: "In Progress", cls: "bg-warning/10 text-warning border-warning/30", icon: Loader2 },
  resolved: { label: "Resolved", cls: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
};

export default function EmergencyDashboard() {
  const { user } = useAuth();
  const { canHandleEmergency } = usePermissions();
  const [items, setItems] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("emergency_requests").select("*").order("created_at", { ascending: false });
    setItems((data || []) as Emergency[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("emergency-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_requests" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const updateStatus = async (id: string, status: "in_progress" | "resolved") => {
    const { error } = await supabase
      .from("emergency_requests")
      .update({ status, handled_by: user?.id ?? null })
      .eq("id", id);
    if (error) return toast.error(error.message);

    // Notify the originating patient if linked
    const item = items.find((i) => i.id === id);
    if (item) {
      const { data } = await supabase.from("emergency_requests").select("user_id").eq("id", id).single();
      if (data?.user_id) {
        await supabase.from("notifications").insert({
          user_id: data.user_id,
          title: status === "in_progress" ? "Help is on the way" : "Emergency resolved",
          message:
            status === "in_progress"
              ? "Our team is responding to your emergency request."
              : "Your emergency request has been resolved.",
          link: "/portal",
          type: "emergency",
        });
      }
    }
    toast.success("Status updated");
  };

  if (!canHandleEmergency) return <Navigate to="/dashboard" replace />;

  const pending = items.filter((i) => i.status === "pending");
  const active = items.filter((i) => i.status === "in_progress");
  const resolved = items.filter((i) => i.status === "resolved");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-7 w-7 text-destructive" /> Emergency Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">
          {pending.length} pending · {active.length} in progress · {resolved.length} resolved
        </p>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-muted-foreground">Loading…</Card>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No emergency requests</Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((e) => {
            const meta = STATUS_META[e.status] || STATUS_META.pending;
            const Icon = meta.icon;
            return (
              <Card
                key={e.id}
                className={`p-4 border-l-4 ${
                  e.status === "pending"
                    ? "border-l-destructive animate-pulse-slow"
                    : e.status === "in_progress"
                    ? "border-l-warning"
                    : "border-l-success"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-semibold">{e.patient_name}</div>
                  <Badge variant="outline" className={meta.cls}>
                    <Icon className="h-3 w-3 mr-1" /> {meta.label}
                  </Badge>
                </div>
                {e.patient_phone && (
                  <a
                    href={`tel:${e.patient_phone}`}
                    className="flex items-center gap-1 text-sm text-primary hover:underline mb-2"
                  >
                    <Phone className="h-3 w-3" /> {e.patient_phone}
                  </a>
                )}
                {e.message && <p className="text-sm text-muted-foreground mb-2">{e.message}</p>}
                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                  <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </div>
                <div className="flex gap-2">
                  {e.status === "pending" && (
                    <Button size="sm" onClick={() => updateStatus(e.id, "in_progress")} className="flex-1">
                      Take action
                    </Button>
                  )}
                  {e.status !== "resolved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(e.id, "resolved")}
                      className="flex-1"
                    >
                      Mark resolved
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
