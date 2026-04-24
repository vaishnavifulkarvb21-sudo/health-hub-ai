-- =========================================
-- DOCTORS
-- =========================================
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialization text,
  contact text,
  email text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctors select" ON public.doctors FOR SELECT TO authenticated USING (true);
CREATE POLICY "doctors insert" ON public.doctors FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "doctors update" ON public.doctors FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "doctors delete" ON public.doctors FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER doctors_updated_at BEFORE UPDATE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optional doctor link on patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS disease text;

-- =========================================
-- APPOINTMENTS
-- =========================================
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | completed | cancelled
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appt select" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "appt insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "appt update" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "appt delete" ON public.appointments FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON public.appointments(status);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_appointment_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('scheduled','completed','cancelled') THEN
    RAISE EXCEPTION 'Invalid appointment status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER appointments_status_validate BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_status();

-- =========================================
-- ACTIVITY LOGS
-- =========================================
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,        -- created|updated|deleted
  entity text NOT NULL,        -- patient|visit|payment|appointment|doctor|lab_report
  entity_id uuid,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert their own logs; only admins can read.
CREATE POLICY "logs insert any auth" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "logs admins select" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "logs admins delete" ON public.activity_logs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);