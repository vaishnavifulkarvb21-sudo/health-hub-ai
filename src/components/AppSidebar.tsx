import { LayoutDashboard, Users, Stethoscope, FlaskConical, Receipt, History, Bot } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import logo from "/medpulse-logo.png";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Patients", url: "/patients", icon: Users },
  { title: "Visits", url: "/visits", icon: Stethoscope },
  { title: "Lab Reports", url: "/reports", icon: FlaskConical },
  { title: "Payments", url: "/payments", icon: Receipt },
  { title: "Medical History", url: "/history", icon: History },
  { title: "AI Assistant", url: "/ai", icon: Bot },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-sidebar">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse-glow p-1.5">
            <img src={logo} alt="MedPulse AI logo" width={40} height={40} className="h-full w-full object-contain brightness-0 invert" />
          </div>
          {!collapsed && (
            <div className="leading-tight animate-slide-in-right">
              <div className="font-semibold text-sm bg-gradient-primary bg-clip-text text-transparent">MedPulse AI</div>
              <div className="text-xs text-muted-foreground">Healthcare System</div>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
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
