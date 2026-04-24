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
import NotFound from "./pages/NotFound";

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
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
              <Route path="/patients" element={<Protected><Patients /></Protected>} />
              <Route path="/appointments" element={<Protected><Appointments /></Protected>} />
              <Route path="/visits" element={<Protected><Visits /></Protected>} />
              <Route path="/doctors" element={<Protected><Doctors /></Protected>} />
              <Route path="/payments" element={<Protected><Payments /></Protected>} />
              <Route path="/reports" element={<Protected><Reports /></Protected>} />
              <Route path="/history" element={<Protected><History /></Protected>} />
              <Route path="/ai" element={<Protected><AIAssistant /></Protected>} />
              <Route path="/activity" element={<Protected><ActivityLog /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
