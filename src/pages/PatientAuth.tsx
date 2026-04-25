import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Phone, ArrowRight, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "/medpulse-logo.png";

export default function PatientAuth() {
  const { user, role, loading } = useAuth();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  if (!loading && user && role === "patient") return <Navigate to="/portal" replace />;
  if (!loading && user && role && role !== "patient") return <Navigate to="/dashboard" replace />;

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 6) return toast.error("Enter a valid phone number with country code");
    setBusy(true);
    setDevCode(null);
    const { data, error } = await supabase.functions.invoke("send-otp", { body: { phone } });
    setBusy(false);
    if (error) return toast.error(error.message || "Failed to send code");
    if (data?.devCode) {
      setDevCode(data.devCode);
      toast.warning(`SMS not configured — your dev code is ${data.devCode}`, { duration: 8000 });
    } else {
      toast.success("Code sent — check your messages");
    }
    setStep("code");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("verify-otp", { body: { phone, code, name } });
    if (error || !data?.success) {
      setBusy(false);
      return toast.error(error?.message || data?.error || "Invalid code");
    }
    // Now sign in with the returned credentials
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setBusy(false);
    if (signInError) return toast.error(signInError.message);
    toast.success("Welcome to your patient portal");
    // Auth provider will redirect
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gradient-subtle">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-float" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center p-1.5">
            <img src={logo} alt="MedPulse AI logo" width={48} height={48} className="h-full w-full object-contain" />
          </div>
          <div className="text-xl font-semibold">MedPulse AI · Patient Portal</div>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-bold leading-tight flex items-center gap-2">
            <Heart className="h-8 w-8" /> Your health, your portal
          </h1>
          <p className="text-primary-foreground/80">
            Book appointments, view your lab reports, check your treatment history, and stay in touch with your care team — all in one place.
          </p>
          <ul className="space-y-2 text-sm text-primary-foreground/90">
            <li>📅 Easy appointment booking</li>
            <li>📄 Instant lab report access</li>
            <li>🚨 One-tap emergency help</li>
            <li>🔔 Real-time notifications</li>
          </ul>
        </div>
        <div className="text-sm text-primary-foreground/70">© {new Date().getFullYear()} MedPulse AI</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 shadow-elegant border-border/60">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center p-1.5">
              <img src={logo} alt="MedPulse AI logo" width={40} height={40} className="h-full w-full object-contain" />
            </div>
            <div className="font-semibold text-foreground">Patient Portal</div>
          </div>

          {step === "phone" ? (
            <>
              <h2 className="text-2xl font-bold mb-1">Sign in with your phone</h2>
              <p className="text-sm text-muted-foreground mb-6">We'll send you a 6-digit verification code</p>
              <form onSubmit={sendCode} className="space-y-4">
                <div>
                  <Label htmlFor="name">Your name (optional, for new accounts)</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      className="pl-9"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Include country code (e.g. +91 for India)</p>
                </div>
                <Button type="submit" className="w-full bg-gradient-primary" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  Send code
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-1">Enter verification code</h2>
              <p className="text-sm text-muted-foreground mb-6">We sent a 6-digit code to {phone}</p>
              {devCode && (
                <div className="mb-4 p-3 rounded-lg bg-warning/10 text-warning text-sm">
                  <strong>Dev mode:</strong> SMS provider not configured. Your code is{" "}
                  <span className="font-mono font-bold">{devCode}</span>
                </div>
              )}
              <form onSubmit={verify} className="space-y-4">
                <div>
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-primary" disabled={busy || code.length !== 6}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Verify & sign in
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("phone")}>
                  Change phone number
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 pt-4 border-t text-center">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary">
              Clinic staff? Sign in here →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
