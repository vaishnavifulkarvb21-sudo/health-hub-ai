import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, History, ArrowRight, Heart, Activity, ClipboardList, User, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";

export default function PatientHome() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [patient, setPatient] = useState<any>(null);
  const [stats, setStats] = useState({ visits: 0, reports: 0, appointments: 0, pendingReports: 0 });
  const [upcoming, setUpcoming] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("patients").select("*").eq("user_id", user.id).maybeSingle();
      setPatient(p);
      if (!p) return;
      const [{ count: vc }, { count: rc }, { count: pendingC }, { data: appts }] = await Promise.all([
        supabase.from("visits").select("*", { count: "exact", head: true }).eq("patient_id", p.id),
        supabase.from("lab_reports").select("*", { count: "exact", head: true }).eq("patient_id", p.id),
        supabase.from("lab_reports").select("*", { count: "exact", head: true }).eq("patient_id", p.id).eq("status", "pending"),
        supabase.from("appointments").select("*").eq("patient_id", p.id).gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(3),
      ]);
      setStats({ visits: vc || 0, reports: rc || 0, appointments: appts?.length || 0, pendingReports: pendingC || 0 });
      setUpcoming(appts || []);
    })();
  }, [user]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Heart className="h-7 w-7 text-primary" />
          {t("portal.welcome", { name: patient?.name || "" })}
        </h1>
        <p className="text-muted-foreground text-sm">{t("portal.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-card">
          <div className="text-xs text-muted-foreground">{t("portal.stats.visits")}</div>
          <div className="text-2xl font-bold mt-1">{stats.visits}</div>
        </Card>
        <Card className="p-4 bg-gradient-card">
          <div className="text-xs text-muted-foreground">{t("portal.stats.reports")}</div>
          <div className="text-2xl font-bold mt-1">{stats.reports}</div>
          {stats.pendingReports > 0 && (
            <Badge variant="outline" className="mt-1 bg-warning/10 text-warning border-warning/30">
              {stats.pendingReports} {t("portal.reportsPage.pending").toLowerCase()}
            </Badge>
          )}
        </Card>
        <Card className="p-4 bg-gradient-card">
          <div className="text-xs text-muted-foreground">{t("portal.stats.upcoming")}</div>
          <div className="text-2xl font-bold mt-1">{stats.appointments}</div>
        </Card>
        <Card className="p-4 bg-gradient-card">
          <div className="text-xs text-muted-foreground">{t("portal.stats.patientId")}</div>
          <div className="text-sm font-mono font-bold mt-1">{patient?.patient_code || "—"}</div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {t("portal.upcoming")}</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t("portal.noUpcoming")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{format(parseISO(a.scheduled_at), "PPp")}</div>
                  <div className="text-xs text-muted-foreground">{a.reason || t("portal.consultation")}</div>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">{a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
        <Link to="/portal/book">
          <Button className="w-full mt-3 bg-gradient-primary">
            <Calendar className="h-4 w-4 mr-2" /> {t("portal.bookAppointment")}
          </Button>
        </Link>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Link to="/portal/reports">
          <Card className="p-5 hover:shadow-elegant transition-smooth cursor-pointer hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {t("portal.nav.reports")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("portal.reportsPage.subtitle")}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        </Link>
        <Link to="/portal/history">
          <Card className="p-5 hover:shadow-elegant transition-smooth cursor-pointer hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> {t("portal.nav.history")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("portal.historyPage.subtitle")}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
