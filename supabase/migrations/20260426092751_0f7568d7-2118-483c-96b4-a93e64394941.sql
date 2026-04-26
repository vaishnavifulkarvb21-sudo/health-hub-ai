
-- 1. Link doctors to auth users
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON public.doctors(user_id);

-- 2. Helper: is the calling user the assigned doctor for this patient?
CREATE OR REPLACE FUNCTION public.is_assigned_doctor(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients p
    JOIN public.doctors d ON d.id = p.doctor_id
    WHERE p.id = _patient_id
      AND d.user_id = auth.uid()
  );
$$;

-- Helper: is calling user clinic staff (any non-patient role)?
CREATE OR REPLACE FUNCTION public.is_clinic_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'doctor'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
    OR public.has_role(auth.uid(), 'user'::app_role);
$$;

-- ===========================================================
-- PATIENTS
-- ===========================================================
DROP POLICY IF EXISTS "patients all auth select" ON public.patients;
DROP POLICY IF EXISTS "patients all auth insert" ON public.patients;
DROP POLICY IF EXISTS "patients all auth update" ON public.patients;
DROP POLICY IF EXISTS "patients delete admin only" ON public.patients;
DROP POLICY IF EXISTS "patients self select" ON public.patients;

-- Admin / staff / legacy user: see all
CREATE POLICY "patients select staff" ON public.patients
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
);

-- Doctor: only patients assigned to them
CREATE POLICY "patients select doctor assigned" ON public.patients
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = patients.doctor_id AND d.user_id = auth.uid()
  )
);

-- Patient: only their own record
CREATE POLICY "patients select self" ON public.patients
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "patients insert clinic" ON public.patients
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
);

CREATE POLICY "patients update clinic" ON public.patients
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
  OR (has_role(auth.uid(), 'doctor'::app_role)
      AND EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = patients.doctor_id AND d.user_id = auth.uid()))
);

CREATE POLICY "patients delete admin" ON public.patients
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================================
-- VISITS
-- ===========================================================
DROP POLICY IF EXISTS "visits select" ON public.visits;
DROP POLICY IF EXISTS "visits insert" ON public.visits;
DROP POLICY IF EXISTS "visits update" ON public.visits;
DROP POLICY IF EXISTS "visits delete admin or doctor" ON public.visits;
DROP POLICY IF EXISTS "visits self select" ON public.visits;

CREATE POLICY "visits select admin user" ON public.visits
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "visits select doctor assigned" ON public.visits
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'doctor'::app_role) AND public.is_assigned_doctor(patient_id));

CREATE POLICY "visits select self" ON public.visits
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = visits.patient_id AND p.user_id = auth.uid()));

CREATE POLICY "visits insert clinic" ON public.visits
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
  OR (has_role(auth.uid(), 'doctor'::app_role) AND public.is_assigned_doctor(patient_id))
);

CREATE POLICY "visits update clinic" ON public.visits
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
  OR (has_role(auth.uid(), 'doctor'::app_role) AND public.is_assigned_doctor(patient_id))
);

CREATE POLICY "visits delete admin doctor" ON public.visits
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
  OR (has_role(auth.uid(), 'doctor'::app_role) AND public.is_assigned_doctor(patient_id))
);

-- ===========================================================
-- LAB REPORTS
-- ===========================================================
DROP POLICY IF EXISTS "lab select" ON public.lab_reports;
DROP POLICY IF EXISTS "lab insert" ON public.lab_reports;
DROP POLICY IF EXISTS "lab update" ON public.lab_reports;
DROP POLICY IF EXISTS "lab delete admin or doctor" ON public.lab_reports;
DROP POLICY IF EXISTS "lab self select" ON public.lab_reports;

CREATE POLICY "lab select admin user" ON public.lab_reports
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "lab select doctor assigned" ON public.lab_reports
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'doctor'::app_role) AND public.is_assigned_doctor(patient_id));

CREATE POLICY "lab select self" ON public.lab_reports
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = lab_reports.patient_id AND p.user_id = auth.uid()));

CREATE POLICY "lab insert clinic" ON public.lab_reports
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
  OR (has_role(auth.uid(), 'doctor'::app_role) AND public.is_assigned_doctor(patient_id))
);

CREATE POLICY "lab update clinic" ON public.lab_reports
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
  OR (has_role(auth.uid(), 'doctor'::app_role) AND public.is_assigned_doctor(patient_id))
);

CREATE POLICY "lab delete admin doctor" ON public.lab_reports
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
  OR (has_role(auth.uid(), 'doctor'::app_role) AND public.is_assigned_doctor(patient_id))
);

-- ===========================================================
-- PAYMENTS  (staff cannot see)
-- ===========================================================
DROP POLICY IF EXISTS "payments select" ON public.payments;
DROP POLICY IF EXISTS "payments insert" ON public.payments;
DROP POLICY IF EXISTS "payments update" ON public.payments;
DROP POLICY IF EXISTS "payments delete admin only" ON public.payments;
DROP POLICY IF EXISTS "payments self select" ON public.payments;

CREATE POLICY "payments select admin user" ON public.payments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "payments select self" ON public.payments
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = payments.patient_id AND p.user_id = auth.uid()));

CREATE POLICY "payments insert admin" ON public.payments
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "payments update admin" ON public.payments
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "payments delete admin" ON public.payments
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================================
-- APPOINTMENTS
-- ===========================================================
DROP POLICY IF EXISTS "appt select" ON public.appointments;
DROP POLICY IF EXISTS "appt insert" ON public.appointments;
DROP POLICY IF EXISTS "appt update" ON public.appointments;
DROP POLICY IF EXISTS "appt delete" ON public.appointments;

CREATE POLICY "appt select clinic" ON public.appointments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
);

CREATE POLICY "appt select doctor" ON public.appointments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND (
    EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = appointments.doctor_id AND d.user_id = auth.uid())
    OR public.is_assigned_doctor(patient_id)
  )
);

CREATE POLICY "appt select self" ON public.appointments
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.user_id = auth.uid()));

CREATE POLICY "appt insert clinic or self" ON public.appointments
FOR INSERT TO authenticated
WITH CHECK (
  public.is_clinic_staff()
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.user_id = auth.uid())
);

CREATE POLICY "appt update clinic or self" ON public.appointments
FOR UPDATE TO authenticated
USING (
  public.is_clinic_staff()
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.user_id = auth.uid())
);

CREATE POLICY "appt delete admin or doctor" ON public.appointments
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
  OR (has_role(auth.uid(), 'doctor'::app_role)
      AND EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = appointments.doctor_id AND d.user_id = auth.uid()))
);

-- ===========================================================
-- DOCTORS  (staff/doctors can read; only admin can mutate)
-- ===========================================================
DROP POLICY IF EXISTS "doctors insert" ON public.doctors;
DROP POLICY IF EXISTS "doctors update" ON public.doctors;
DROP POLICY IF EXISTS "doctors delete" ON public.doctors;

CREATE POLICY "doctors insert admin" ON public.doctors
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "doctors update admin or self" ON public.doctors
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
  OR user_id = auth.uid()
);

CREATE POLICY "doctors delete admin" ON public.doctors
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));
