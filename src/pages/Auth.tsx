import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "/medpulse-logo.png";

export default function AuthPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({ email: "", password: "", fullName: "" });

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(signInData.email.trim(), signInData.password);
    setBusy(false);
    if (error) toast.error(error);
    else toast.success("Welcome back!");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpData.password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    const { error } = await signUp(signUpData.email.trim(), signUpData.password, signUpData.fullName.trim());
    setBusy(false);
    if (error) toast.error(error);
    else toast.success("Account created — you can sign in now.");
  };

  const fillDemo = (type: "admin" | "user") => {
    setSignInData(
      type === "admin"
        ? { email: "admin@demo.com", password: "admin123" }
        : { email: "user@demo.com", password: "user123" }
    );
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gradient-subtle">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-float" />
        <div className="absolute bottom-10 -left-10 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
        <div className="flex items-center gap-3 relative z-10 animate-slide-in-left">
          <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur p-1.5 animate-heartbeat">
            <img src={logo} alt="MedPulse AI logo" width={48} height={48} className="h-full w-full object-contain brightness-0 invert" />
          </div>
          <div className="text-xl font-semibold">MedPulse AI</div>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">AI-powered Smart Healthcare Management</h1>
          <p className="text-primary-foreground/80">
            Manage patients, visits, lab reports, and billing in one beautiful workspace — with built-in AI assistance and predictive insights.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/70">© {new Date().getFullYear()} MedPulse AI · Built for clinics, hospitals & pathology labs</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 shadow-elegant border-border/60 animate-scale-in">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center p-1.5 animate-pulse-glow">
              <img src={logo} alt="MedPulse AI logo" width={40} height={40} className="h-full w-full object-contain brightness-0 invert" />
            </div>
            <div className="font-semibold bg-gradient-primary bg-clip-text text-transparent">MedPulse AI</div>
          </div>
          <h2 className="text-2xl font-bold mb-1">Welcome</h2>
          <p className="text-sm text-muted-foreground mb-6">Sign in or create an account to continue</p>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 mb-4 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" required value={signInData.email} onChange={(e) => setSignInData({ ...signInData, email: e.target.value })} placeholder="you@clinic.com" />
                </div>
                <div>
                  <Label htmlFor="si-pwd">Password</Label>
                  <div className="relative">
                    <Input id="si-pwd" type={showPwd ? "text" : "password"} required value={signInData.password} onChange={(e) => setSignInData({ ...signInData, password: e.target.value })} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 transition-smooth" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Sign in
                </Button>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Try demo accounts:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fillDemo("admin")}>Admin demo</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => fillDemo("user")}>User demo</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">admin@demo.com / admin123 · user@demo.com / user123</p>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" required value={signUpData.fullName} onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })} placeholder="Dr. Jane Doe" />
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" required value={signUpData.email} onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="su-pwd">Password</Label>
                  <div className="relative">
                    <Input id="su-pwd" type={showPwd ? "text" : "password"} required minLength={6} value={signUpData.password} onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">New accounts are created as Doctor / Staff. Only an admin can grant admin access.</p>
                <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
