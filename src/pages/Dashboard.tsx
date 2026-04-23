import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Users, Receipt, Stethoscope, TrendingUp, Sparkles, Loader2, Activity, AlertCircle, Calendar, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { format, subDays, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Stats {
  totalPatients: number;
  totalRevenue: number;
  dailyVisits: number;
  paid: number;
  unpaid: number;
}

// Animated counter hook
const useCounter = (target: number, duration = 1000) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return count;
};

const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
  const c = useCounter(value);
  return <>{prefix}{c.toLocaleString()}{suffix}</>;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalPatients: 0, totalRevenue: 0, dailyVisits: 0, paid: 0, unpaid: 0 });
  const [revenueByDay, setRevenueByDay] = useState<{ day: string; revenue: number }[]>([]);
  const [visitsByDay, setVisitsByDay] = useState<{ day: string; visits: number }[]>([]);
  const [genderData, setGenderData] = useState<{ name: string; value: number }[]>([]);
  const [topPatients, setTopPatients] = useState<{ name: string; visits: number; code: string }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ kind: string; label: string; at: string }[]>([]);
  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  const loadData = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ count: pc }, { data: pays }, { data: visits }, { data: patients }] = await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("payments").select("*"),
      supabase.from("visits").select("*"),
      supabase.from("patients").select("id, name, gender, patient_code, created_at"),
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

    // Top patients by visit count
    const visitCounts = new Map<string, number>();
    (visits || []).forEach((v) => visitCounts.set(v.patient_id, (visitCounts.get(v.patient_id) || 0) + 1));
    const ranked = (patients || [])
      .map((p) => ({ name: p.name, code: p.patient_code, visits: visitCounts.get(p.id) || 0 }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);
    setTopPatients(ranked);

    // Recent activity (latest visits + payments + patients)
    const activity: { kind: string; label: string; at: string }[] = [];
    (visits || []).slice(-5).forEach((v) => {
      const p = (patients || []).find((x) => x.id === v.patient_id);
      activity.push({ kind: "visit", label: `Visit recorded for ${p?.name || "patient"}`, at: v.created_at });
    });
    (pays || []).slice(-5).forEach((p) => {
      const pat = (patients || []).find((x) => x.id === p.patient_id);
      activity.push({ kind: "payment", label: `${p.status === "paid" ? "Paid" : "Bill"} ₹${p.amount} — ${pat?.name || "patient"}`, at: p.created_at });
    });
    (patients || []).slice(-5).forEach((p) => {
      activity.push({ kind: "patient", label: `New patient: ${p.name}`, at: p.created_at });
    });
    activity.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    setRecentActivity(activity.slice(0, 6));
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

  const KPI = ({ label, value, icon: Icon, accent, delay = 0 }: any) => (
    <Card
      className="p-5 bg-gradient-card border-border/60 shadow-elegant transition-smooth hover:shadow-glow hover:-translate-y-1 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent} animate-float`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--primary-glow))", "hsl(var(--muted-foreground))"];

  const collectionRate = stats.paid + stats.unpaid > 0 ? Math.round((stats.paid / (stats.paid + stats.unpaid)) * 100) : 0;
  const avgRevenue = stats.paid > 0 ? Math.round(stats.totalRevenue / stats.paid) : 0;

  return (
    <div className="space-y-6">
      <div className="animate-slide-in-left">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          Dashboard
          <span className="inline-flex items-center gap-1 text-xs font-normal text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> Live
          </span>
        </h1>
        <p className="text-muted-foreground text-sm">Real-time overview of your healthcare operations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI delay={0} label="Total Patients" value={<AnimatedNumber value={stats.totalPatients} />} icon={Users} accent="bg-primary/10 text-primary" />
        <KPI delay={80} label="Total Revenue" value={<AnimatedNumber value={stats.totalRevenue} prefix="₹" />} icon={TrendingUp} accent="bg-success/10 text-success" />
        <KPI delay={160} label="Today's Visits" value={<AnimatedNumber value={stats.dailyVisits} />} icon={Stethoscope} accent="bg-accent text-accent-foreground" />
        <KPI delay={240} label="Paid / Unpaid" value={`${stats.paid} / ${stats.unpaid}`} icon={Receipt} accent="bg-warning/10 text-warning" />
      </div>

      {/* Extra mini-stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5 bg-card border-border/60 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Collection rate</div>
              <div className="text-lg font-semibold">{collectionRate}%</div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-primary transition-all duration-700" style={{ width: `${collectionRate}%` }} />
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-card border-border/60 animate-fade-in" style={{ animationDelay: "80ms", animationFillMode: "backwards" }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Average bill</div>
              <div className="text-lg font-semibold">₹<AnimatedNumber value={avgRevenue} /></div>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-card border-border/60 animate-fade-in" style={{ animationDelay: "160ms", animationFillMode: "backwards" }}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stats.unpaid > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pending bills alert</div>
              <div className="text-lg font-semibold">{stats.unpaid > 0 ? `${stats.unpaid} unpaid bills` : "All clear"}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 bg-card border-border/60 animate-fade-in">
          <h3 className="font-semibold mb-3">Revenue (last 7 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByDay}>
                <defs>
                  <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#rev-grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border/60 animate-fade-in" style={{ animationDelay: "100ms", animationFillMode: "backwards" }}>
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

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 bg-card border-border/60 animate-fade-in">
          <h3 className="font-semibold mb-3">Daily visits trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top patients leaderboard */}
        <Card className="p-5 bg-card border-border/60 animate-fade-in" style={{ animationDelay: "100ms", animationFillMode: "backwards" }}>
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Top patients</h3>
          <div className="space-y-2">
            {topPatients.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            {topPatients.map((p, i) => (
              <div
                key={p.code}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-smooth animate-slide-in-right"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-warning/20 text-warning" : "bg-primary/10 text-primary"}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.code}</div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">{p.visits} visits</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent activity feed */}
      <Card className="p-5 bg-card border-border/60 animate-fade-in">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Recent activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentActivity.map((a, i) => (
              <li
                key={i}
                className="py-2.5 flex items-center gap-3 animate-slide-in-left"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  a.kind === "visit" ? "bg-primary/10 text-primary" :
                  a.kind === "payment" ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"
                }`}>
                  {a.kind === "visit" ? <Stethoscope className="h-4 w-4" /> : a.kind === "payment" ? <Receipt className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.at), { addSuffix: true })}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 bg-gradient-card border-border/60 animate-fade-in">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary animate-pulse" /> AI Smart Insights</h3>
            <p className="text-sm text-muted-foreground">Trends, predictions & recommendations powered by AI</p>
          </div>
          <Button onClick={generateInsight} disabled={loadingInsight} className="bg-gradient-primary hover:opacity-90 transition-smooth">
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
