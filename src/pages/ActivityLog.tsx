import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollText, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface LogEntry {
  id: string;
  user_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

const ACTION_STYLES: Record<string, string> = {
  created: "bg-success/10 text-success border-success/30",
  updated: "bg-primary/10 text-primary border-primary/30",
  deleted: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function ActivityLog() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return toast.error(error.message);
    setLogs((data || []) as LogEntry[]);
  };

  useEffect(() => {
    if (role === "admin") load();
  }, [role]);

  const clearAll = async () => {
    if (!confirm("Clear all activity logs? This cannot be undone.")) return;
    const { error } = await supabase.from("activity_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return toast.error(error.message);
    toast.success("Logs cleared");
    load();
  };

  if (role !== "admin") {
    return (
      <Card className="p-12 text-center">
        <ScrollText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-xl font-semibold">Admin access required</h2>
        <p className="text-muted-foreground text-sm mt-2">Activity logs are visible to administrators only.</p>
      </Card>
    );
  }

  const filtered = logs.filter((l) => {
    const s = search.toLowerCase();
    return !s || (l.user_email || "").toLowerCase().includes(s) || l.entity.includes(s) || (l.details || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><ScrollText className="h-7 w-7 text-primary" /> Activity Log</h1>
          <p className="text-muted-foreground text-sm">{logs.length} recorded actions (latest 500)</p>
        </div>
        <Button variant="outline" onClick={clearAll} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Clear all
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by user, entity or details…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</TableCell>
                  <TableCell className="text-sm">{l.user_email || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={ACTION_STYLES[l.action] || ""}>{l.action}</Badge></TableCell>
                  <TableCell className="text-sm capitalize">{l.entity}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">{l.details}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No activity yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
