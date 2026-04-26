import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import "@/i18n";
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import PatientAuth from "./pages/PatientAuth";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Visits from "./pages/Visits";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import History from "./pages/History";
import AIAssistant from "./pages/AIAssistant";
import Doctors from "./pages/Doctors";
import Appointments from "./pages/Appointments";
import ActivityLog from "./pages/ActivityLog";
import EmergencyDashboard from "./pages/EmergencyDashboard";
import { PatientLayout } from "./components/PatientLayout";
import PatientHome from "./pages/portal/PatientHome";
import BookAppointment from "./pages/portal/BookAppointment";
import PatientReports from "./pages/portal/PatientReports";
import PatientHistory from "./pages/portal/PatientHistory";
import NotFound from "./pages/NotFound";
import { RequireRole } from "./components/RequireRole";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: JSX.Element }) => <AppLayout>{children}</AppLayout>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/patient-auth" element={<PatientAuth />} />
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
              <Route path="/patients" element={<Protected><RequireRole allow={["admin","doctor","staff","user"]}><Patients /></RequireRole></Protected>} />
              <Route path="/appointments" element={<Protected><RequireRole allow={["admin","doctor","staff","user"]}><Appointments /></RequireRole></Protected>} />
              <Route path="/visits" element={<Protected><RequireRole allow={["admin","doctor","user"]}><Visits /></RequireRole></Protected>} />
              <Route path="/doctors" element={<Protected><RequireRole allow={["admin","user"]}><Doctors /></RequireRole></Protected>} />
              <Route path="/payments" element={<Protected><RequireRole allow={["admin","user"]}><Payments /></RequireRole></Protected>} />
              <Route path="/reports" element={<Protected><RequireRole allow={["admin","doctor","user"]}><Reports /></RequireRole></Protected>} />
              <Route path="/history" element={<Protected><RequireRole allow={["admin","doctor","user"]}><History /></RequireRole></Protected>} />
              <Route path="/ai" element={<Protected><RequireRole allow={["admin","doctor","staff","user"]}><AIAssistant /></RequireRole></Protected>} />
              <Route path="/activity" element={<Protected><RequireRole allow={["admin"]}><ActivityLog /></RequireRole></Protected>} />
              <Route path="/emergency" element={<Protected><RequireRole allow={["admin","doctor","user"]}><EmergencyDashboard /></RequireRole></Protected>} />
              <Route path="/portal" element={<PatientLayout><PatientHome /></PatientLayout>} />
              <Route path="/portal/book" element={<PatientLayout><BookAppointment /></PatientLayout>} />
              <Route path="/portal/reports" element={<PatientLayout><PatientReports /></PatientLayout>} />
              <Route path="/portal/history" element={<PatientLayout><PatientHistory /></PatientLayout>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
