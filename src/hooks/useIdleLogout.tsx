import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const IDLE_MS = 15 * 60 * 1000; // 15 minutes
const WARN_MS = 60 * 1000;      // 1-minute warning

export function useIdleLogout() {
  const { user, signOut } = useAuth();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      warnTimer.current = setTimeout(() => {
        toast.warning("You will be signed out soon due to inactivity.");
      }, IDLE_MS - WARN_MS);
      idleTimer.current = setTimeout(async () => {
        toast.error("Signed out due to inactivity.");
        await signOut();
      }, IDLE_MS);
    };

    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };
  }, [user, signOut]);
}
