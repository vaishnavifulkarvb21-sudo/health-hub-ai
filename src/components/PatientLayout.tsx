import { ReactNode, useEffect, useState } from "react";
import { Navigate, useNavigate, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, LogOut, Heart, Calendar, FileText, History, Home, ClipboardList, User } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { EmergencyButton } from "./EmergencyButton";
import { AIFloatingChat } from "./AIFloatingChat";
import logo from "/medpulse-logo.png";

export function PatientLayout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { user, role, loading, signOut } = useAuth();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  useIdleLogout();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  if (!user) return <Navigate to="/patient-auth" replace />;
  if (role && role !== "patient") return <Navigate to="/dashboard" replace />;

  const items = [
    { to: "/portal", icon: Home, label: "Home" },
    { to: "/portal/book", icon: Calendar, label: "Book" },
    { to: "/portal/appointments", icon: ClipboardList, label: "Appointments" },
    { to: "/portal/reports", icon: FileText, label: "Reports" },
    { to: "/portal/history", icon: History, label: "History" },
    { to: "/portal/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-subtle">
      <header className="h-14 border-b bg-card/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center p-1">
            <img src={logo} alt="MedPulse AI logo" className="h-full w-full object-contain" />
          </div>
          <div className="font-semibold text-sm hidden sm:block">MedPulse AI</div>
          <Badge className="hidden sm:inline-flex bg-primary text-primary-foreground hover:bg-primary/90"><Heart className="h-3 w-3 mr-1" /> Patient</Badge>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <LanguageSwitcher />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("header.toggleTheme")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label={t("header.signOut")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="bg-card border-b sticky top-14 z-20">
        <div className="max-w-5xl mx-auto px-2 flex overflow-x-auto">
          {items.map((it) => {
            const active = pathname === it.to;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/portal"}
                className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-smooth ${
                  active ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto animate-fade-in">{children}</main>
      <EmergencyButton />
    </div>
  );
}
