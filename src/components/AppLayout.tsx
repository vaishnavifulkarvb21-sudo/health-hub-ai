import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, Search } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { EmergencyButton } from "./EmergencyButton";
import { AIFloatingChat } from "./AIFloatingChat";
import { usePermissions } from "@/hooks/usePermissions";
import { ShieldCheck } from "lucide-react";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { theme, toggle } = useTheme();
  const { user, role, loading, signOut } = useAuth();
  const { displayRole } = usePermissions();
  const { t } = useTranslation();
  useIdleLogout();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  // Patients must use the patient portal, not clinic-side pages.
  if (role === "patient") return <Navigate to="/portal" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-4 gap-3">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4" /> {t("header.quickSearch")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="hidden sm:inline-flex gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                <ShieldCheck className="h-3 w-3" /> {displayRole}
              </Badge>
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
          <main className="flex-1 p-4 md:p-6 animate-fade-in">{children}</main>
        </div>
        <EmergencyButton />
        <AIFloatingChat />
      </div>
    </SidebarProvider>
  );
};
