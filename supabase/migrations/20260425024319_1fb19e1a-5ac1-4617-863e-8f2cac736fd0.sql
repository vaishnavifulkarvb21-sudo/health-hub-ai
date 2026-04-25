
-- Patients additions
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id);

-- Lab report status
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif select own" ON public.notifications;
CREATE POLICY "notif select own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "notif update own" ON public.notifications;
CREATE POLICY "notif update own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif insert auth" ON public.notifications;
CREATE POLICY "notif insert auth" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "notif delete own" ON public.notifications;
CREATE POLICY "notif delete own" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Emergency requests
CREATE TABLE IF NOT EXISTS public.emergency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid,
  patient_name text NOT NULL,
  patient_phone text,
  user_id uuid,
  message text,
  status text NOT NULL DEFAULT 'pending',
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emergency_status ON public.emergency_requests(status, created_at DESC);
ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emerg select own or staff" ON public.emergency_requests;
CREATE POLICY "emerg select own or staff" ON public.emergency_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'user')
    OR public.has_role(auth.uid(), 'staff')
  );
DROP POLICY IF EXISTS "emerg insert auth" ON public.emergency_requests;
CREATE POLICY "emerg insert auth" ON public.emergency_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "emerg update staff" ON public.emergency_requests;
CREATE POLICY "emerg update staff" ON public.emergency_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'user')
  );
DROP POLICY IF EXISTS "emerg delete admin" ON public.emergency_requests;
CREATE POLICY "emerg delete admin" ON public.emergency_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_emerg_updated ON public.emergency_requests;
CREATE TRIGGER trg_emerg_updated BEFORE UPDATE ON public.emergency_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Time slots
CREATE TABLE IF NOT EXISTS public.time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_booked boolean NOT NULL DEFAULT false,
  appointment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slots_doctor_time ON public.time_slots(doctor_id, starts_at);
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slots read auth" ON public.time_slots;
CREATE POLICY "slots read auth" ON public.time_slots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "slots write staff" ON public.time_slots;
CREATE POLICY "slots write staff" ON public.time_slots FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'user')
  );
DROP POLICY IF EXISTS "slots update auth" ON public.time_slots;
CREATE POLICY "slots update auth" ON public.time_slots FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "slots delete staff" ON public.time_slots;
CREATE POLICY "slots delete staff" ON public.time_slots FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'user'));

-- Appointments slot link
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS slot_id uuid;

-- Phone OTP storage (no public access - only edge functions via service role)
CREATE TABLE IF NOT EXISTS public.phone_otp (
  phone text PRIMARY KEY,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_otp ENABLE ROW LEVEL SECURITY;

-- Tighten role-based DELETE policies
DROP POLICY IF EXISTS "patients authenticated delete" ON public.patients;
CREATE POLICY "patients delete admin only" ON public.patients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "patients self select" ON public.patients;
CREATE POLICY "patients self select" ON public.patients FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "visits authenticated delete" ON public.visits;
CREATE POLICY "visits delete admin or doctor" ON public.visits FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
DROP POLICY IF EXISTS "visits self select" ON public.visits;
CREATE POLICY "visits self select" ON public.visits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "payments authenticated delete" ON public.payments;
CREATE POLICY "payments delete admin only" ON public.payments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "payments self select" ON public.payments;
CREATE POLICY "payments self select" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "lab authenticated delete" ON public.lab_reports;
CREATE POLICY "lab delete admin or doctor" ON public.lab_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
DROP POLICY IF EXISTS "lab self select" ON public.lab_reports;
CREATE POLICY "lab self select" ON public.lab_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

-- Notify patient on report ready
CREATE OR REPLACE FUNCTION public.notify_report_ready()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pat_user uuid;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'ready' AND OLD.status IS DISTINCT FROM 'ready')
     OR (TG_OP = 'INSERT' AND NEW.status = 'ready') THEN
    SELECT user_id INTO pat_user FROM public.patients WHERE id = NEW.patient_id;
    IF pat_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, type)
      VALUES (pat_user, 'Lab report ready', NEW.title || ' is ready to download', '/portal/reports', 'report');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lab_notify ON public.lab_reports;
CREATE TRIGGER trg_lab_notify AFTER INSERT OR UPDATE ON public.lab_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_ready();

-- Notify staff on new emergency
CREATE OR REPLACE FUNCTION public.notify_emergency_staff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id, '🚨 Emergency: ' || NEW.patient_name,
         COALESCE(NEW.message, 'New emergency request received'),
         '/emergency', 'emergency'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'doctor', 'user');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_emerg_notify ON public.emergency_requests;
CREATE TRIGGER trg_emerg_notify AFTER INSERT ON public.emergency_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_emergency_staff();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_requests;
