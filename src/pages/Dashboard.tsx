import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Users, Receipt, Stethoscope, TrendingUp, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";

interface Stats {
  totalPatients: number;
  totalRevenue: number;
  dailyVisits: number;
  paid: number;
  unpaid: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalPatients: 0, totalRevenue: 0, dailyVisits: 0, paid: 0, unpaid: 0 });
  const [revenueByDay, setRevenueByDay] = useState<{ day: string; revenue: number }[]>([]);
  const [visitsByDay, setVisitsByDay] = useState<{ day: string; visits: number }[]>([]);
  const [genderData, setGenderData] = useState<{ name: string; value: number }[]>([]);
  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  const loadData = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ count: pc }, { data: pays }, { data: visits }, { data: patients }] = await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("payments").select("*"),
      supabase.from("visits").select("*"),
      supabase.from("patients").select("gender"),
    ]);

    const totalRevenue = (pays || []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
    const paid = (pays || []).filter((p) => p.status === "paid").length;
    const unpaid = (pays || []).filter((p) => p.status === "unpaid").length;
    const dailyVisits = (visits || []).filter((v) => v.visit_date === today).length;
    setStats({ totalPatients: pc || 0, totalRevenue, dailyVisits, paid, unpaid });

    // Last 7 days
    const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
    setRevenueByDay(days.map((d) => {
      const k = d.toISOString().slice(0, 10);
      const rev = (pays || []).filter((p) => p.bill_date === k && p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
      return { day: format(d, "MMM dd"), revenue: Math.round(rev) };
    }));
    setVisitsByDay(days.map((d) => {
      const k = d.toISOString().slice(0, 10);
      return { day: format(d, "MMM dd"), visits: (visits || []).filter((v) => v.visit_date === k).length };
    }));

    const males = (patients || []).filter((p) => p.gender === "Male").length;
    const females = (patients || []).filter((p) => p.gender === "Female").length;
    const others = (patients || []).filter((p) => !["Male", "Female"].includes(p.gender)).length;
    setGenderData([
      { name: "Male", value: males },
      { name: "Female", value: females },
      ...(others ? [{ name: "Other", value: others }] : []),
    ]);
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const generateInsight = async () => {
    setLoadingInsight(true);
    setInsight("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { stats, revenueByDay, visitsByDay, genderData },
      });
      if (error) throw error;
      setInsight(data?.insight || "No insight generated.");
    } catch (e: any) {
      setInsight("Couldn't generate insight: " + (e.message || e));
    } finally {
      setLoadingInsight(false);
    }
  };

  const KPI = ({ label, value, icon: Icon, accent }: any) => (
    <Card className="p-5 bg-gradient-card border-border/60 shadow-elegant transition-smooth hover:shadow-glow">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--primary-glow))", "hsl(var(--muted-foreground))"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Real-time overview of your healthcare operations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Patients" value={stats.totalPatients} icon={Users} accent="bg-primary/10 text-primary" />
        <KPI label="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={TrendingUp} accent="bg-success/10 text-success" />
        <KPI label="Today's Visits" value={stats.dailyVisits} icon={Stethoscope} accent="bg-accent text-accent-foreground" />
        <KPI label="Paid / Unpaid" value={`${stats.paid} / ${stats.unpaid}`} icon={Receipt} accent="bg-warning/10 text-warning" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 bg-card border-border/60">
          <h3 className="font-semibold mb-3">Revenue (last 7 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border/60">
          <h3 className="font-semibold mb-3">Patient gender</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {genderData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs mt-2">
              {genderData.map((g, i) => (
                <div key={g.name} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  {g.name}: {g.value}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 bg-card border-border/60">
        <h3 className="font-semibold mb-3">Daily visits trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visitsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5 bg-gradient-card border-border/60">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Smart Insights</h3>
            <p className="text-sm text-muted-foreground">Trends, predictions & recommendations powered by AI</p>
          </div>
          <Button onClick={generateInsight} disabled={loadingInsight} className="bg-gradient-primary">
            {loadingInsight ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </div>
        {insight && (
          <div className="text-sm whitespace-pre-wrap leading-relaxed bg-background/50 rounded-lg p-4 border border-border/60 animate-fade-in">
            {insight}
          </div>
        )}
      </Card>
    </div>
  );
}
