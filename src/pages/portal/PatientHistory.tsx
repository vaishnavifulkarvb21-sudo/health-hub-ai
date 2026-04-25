import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Stethoscope, Receipt, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";

export default function PatientHistory() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [visits, setVisits] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (!p) { setLoading(false); return; }
      const [{ data: v }, { data: pay }, { data: a }] = await Promise.all([
        supabase.from("visits").select("*").eq("patient_id", p.id).order("visit_date", { ascending: false }),
        supabase.from("payments").select("*").eq("patient_id", p.id).order("bill_date", { ascending: false }),
        supabase.from("appointments").select("*").eq("patient_id", p.id).order("scheduled_at", { ascending: false }),
      ]);
      setVisits(v || []); setPayments(pay || []); setAppts(a || []);
      setLoading(false);
    })();
  }, [user]);

  const timeline = [
    ...visits.map((v) => ({ kind: "visit" as const, date: v.visit_date, item: v })),
    ...payments.map((p) => ({ kind: "payment" as const, date: p.bill_date, item: p })),
    ...appts.map((a) => ({ kind: "appt" as const, date: a.scheduled_at.slice(0, 10), item: a })),
  ].sort((a, b) => (b.date > a.date ? 1 : -1));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><History className="h-7 w-7 text-primary" /> {t("portal.historyPage.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("portal.historyPage.subtitle")}</p>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-muted-foreground">{t("common.loading")}</Card>
      ) : timeline.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">{t("portal.historyPage.empty")}</Card>
      ) : (
        <Card className="p-5">
          <ol className="relative border-l border-border ml-3 space-y-5">
            {timeline.map((t2, i) => (
              <li key={i} className="ml-5">
                <span className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ${
                  t2.kind === "visit" ? "bg-primary" : t2.kind === "payment" ? "bg-warning" : "bg-success"
                }`} />
                <div className="text-xs text-muted-foreground mb-1">{format(parseISO(t2.date), "PP")}</div>
                {t2.kind === "visit" && (
                  <Card className="p-3 bg-card">
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <Stethoscope className="h-4 w-4 text-primary" /> {t("portal.historyPage.visit")}
                    </div>
                    {t2.item.diagnosis && <div className="text-sm"><b>{t("portal.historyPage.diagnosis")}:</b> {t2.item.diagnosis}</div>}
                    {t2.item.symptoms && <div className="text-sm text-muted-foreground"><b>{t("portal.historyPage.symptoms")}:</b> {t2.item.symptoms}</div>}
                    {t2.item.prescription && <div className="text-sm text-muted-foreground mt-1"><b>{t("portal.historyPage.prescription")}:</b> {t2.item.prescription}</div>}
                  </Card>
                )}
                {t2.kind === "payment" && (
                  <Card className="p-3 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Receipt className="h-4 w-4 text-warning" /> ₹{t2.item.amount}
                      </div>
                      <Badge variant="outline" className={t2.item.status === "paid" ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}>
                        {t2.item.status}
                      </Badge>
                    </div>
                    {t2.item.description && <div className="text-xs text-muted-foreground mt-1">{t2.item.description}</div>}
                  </Card>
                )}
                {t2.kind === "appt" && (
                  <Card className="p-3 bg-card">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="h-4 w-4 text-success" /> {t("portal.historyPage.appointment")}
                    </div>
                    <div className="text-xs text-muted-foreground">{format(parseISO(t2.item.scheduled_at), "PPp")}</div>
                    <Badge variant="outline" className="mt-1 text-[10px]">{t2.item.status}</Badge>
                  </Card>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
