import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function PatientReports() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
    if (!p) { setLoading(false); return; }
    const { data } = await supabase
      .from("lab_reports")
      .select("*")
      .eq("patient_id", p.id)
      .order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("lab-reports").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Failed to download");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" /> {t("portal.reportsPage.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("portal.reportsPage.subtitle")}</p>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-muted-foreground">{t("common.loading")}</Card>
      ) : reports.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">{t("portal.reportsPage.empty")}</Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {reports.map((r) => {
            const ready = r.status === "ready";
            return (
              <Card key={r.id} className="p-4 hover:shadow-elegant transition-smooth">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-medium">{r.title}</div>
                  <Badge variant="outline" className={ready ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}>
                    {ready ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                    {ready ? t("portal.reportsPage.ready") : t("portal.reportsPage.pending")}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-3">{new Date(r.created_at).toLocaleDateString()}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={!ready}
                  onClick={() => download(r.file_path)}
                >
                  <Download className="h-4 w-4 mr-2" /> {ready ? t("common.download") : t("portal.reportsPage.notReady")}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
