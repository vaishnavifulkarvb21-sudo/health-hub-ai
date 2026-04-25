import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "user" | "doctor" | "staff" | "patient";
interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    setRole((data?.role as Role) ?? "user");
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => fetchRole(sess.user.id), 0);
      } else {
        setRole(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) fetchRole(sess.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Auto-create demo accounts if missing
    const demos: Record<string, { password: string; fullName: string; role: Role }> = {
      "admin@demo.com": { password: "admin123", fullName: "Demo Admin", role: "admin" },
      "user@demo.com": { password: "user123", fullName: "Demo User", role: "user" },
    };
    const demo = demos[email.toLowerCase()];

    let { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error && demo && demo.password === password) {
      // Try to create the demo account on the fly
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: demo.fullName } },
      });
      if (!signUpErr) {
        const retry = await supabase.auth.signInWithPassword({ email, password });
        error = retry.error;
        if (!retry.error && demo.role === "admin" && retry.data.user) {
          // Promote to admin
          await supabase.from("user_roles").upsert({ user_id: retry.data.user.id, role: "admin" });
        }
      }
    }
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return <Ctx.Provider value={{ user, session, role, loading, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
