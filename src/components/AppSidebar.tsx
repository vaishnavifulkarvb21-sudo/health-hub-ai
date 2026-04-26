import { LayoutDashboard, Users, Stethoscope, FlaskConical, Receipt, History, Bot, Calendar, UserCog, ScrollText, AlertTriangle } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/hooks/usePermissions";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import logo from "/medpulse-logo.png";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { role } = useAuth();
  const perms = usePermissions();

  const items = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: LayoutDashboard, show: true },
    { title: t("nav.patients"), url: "/patients", icon: Users, show: perms.isAdmin || perms.isDoctor || perms.isStaff || perms.isLegacyUser },
    { title: t("nav.appointments"), url: "/appointments", icon: Calendar, show: perms.isAdmin || perms.isDoctor || perms.isStaff || perms.isLegacyUser },
    { title: t("nav.visits"), url: "/visits", icon: Stethoscope, show: perms.isAdmin || perms.isDoctor || perms.isLegacyUser },
    { title: t("nav.doctors"), url: "/doctors", icon: UserCog, show: perms.canManageDoctors },
    { title: t("nav.reports"), url: "/reports", icon: FlaskConical, show: perms.isAdmin || perms.isDoctor || perms.isLegacyUser },
    { title: t("nav.payments"), url: "/payments", icon: Receipt, show: perms.isAdmin || perms.isLegacyUser },
    { title: t("nav.history"), url: "/history", icon: History, show: perms.isAdmin || perms.isDoctor || perms.isLegacyUser },
    { title: t("nav.ai"), url: "/ai", icon: Bot, show: perms.isClinicSide },
    { title: t("nav.emergency"), url: "/emergency", icon: AlertTriangle, show: perms.canHandleEmergency },
    { title: t("nav.activity"), url: "/activity", icon: ScrollText, show: perms.canViewActivityLog },
  ].filter((i) => i.show);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-sidebar">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center p-1.5">
            <img src={logo} alt="MedPulse AI logo" width={40} height={40} className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-semibold text-sm text-foreground">MedPulse AI</div>
              <div className="text-xs text-muted-foreground">Healthcare System</div>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.url} end className="transition-smooth">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
