-- Prevent duplicate slots for the same doctor and start time
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_slots_doctor_starts_unique
ON public.time_slots (doctor_id, starts_at);

-- Generate default future appointment slots for a doctor/day and return visible slots
CREATE OR REPLACE FUNCTION public.get_or_create_doctor_day_slots(_doctor_id uuid, _slot_date date)
RETURNS TABLE (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  is_booked boolean,
  doctor_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slot_start timestamptz;
  slot_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to view appointment slots';
  END IF;

  IF _slot_date < CURRENT_DATE THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = _doctor_id) THEN
    RAISE EXCEPTION 'Doctor not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.time_slots ts
    WHERE ts.doctor_id = _doctor_id
      AND ts.starts_at >= _slot_date::timestamptz
      AND ts.starts_at < (_slot_date + 1)::timestamptz
  ) THEN
    FOR i IN 0..15 LOOP
      slot_start := (_slot_date::timestamp + time '09:00' + (i * interval '30 minutes')) AT TIME ZONE current_setting('TIMEZONE');
      slot_end := slot_start + interval '30 minutes';

      IF slot_start > now() THEN
        INSERT INTO public.time_slots (doctor_id, starts_at, ends_at)
        VALUES (_doctor_id, slot_start, slot_end)
        ON CONFLICT (doctor_id, starts_at) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY
  SELECT ts.id, ts.starts_at, ts.ends_at, ts.is_booked, ts.doctor_id
  FROM public.time_slots ts
  WHERE ts.doctor_id = _doctor_id
    AND ts.starts_at >= _slot_date::timestamptz
    AND ts.starts_at < (_slot_date + 1)::timestamptz
    AND ts.starts_at > now()
  ORDER BY ts.starts_at;
END;
$$;

-- Book a patient appointment atomically without allowing double-booking
CREATE OR REPLACE FUNCTION public.book_patient_appointment(
  _slot_id uuid,
  _visit_type text DEFAULT 'consultation',
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_patient_id uuid;
  slot_record public.time_slots%ROWTYPE;
  appointment_id uuid;
  reason_text text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book an appointment';
  END IF;

  SELECT p.id INTO current_patient_id
  FROM public.patients p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF current_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient profile not found';
  END IF;

  SELECT * INTO slot_record
  FROM public.time_slots
  WHERE id = _slot_id
  FOR UPDATE;

  IF slot_record.id IS NULL THEN
    RAISE EXCEPTION 'Time slot not found';
  END IF;

  IF slot_record.starts_at <= now() THEN
    RAISE EXCEPTION 'This time slot has already passed';
  END IF;

  IF slot_record.is_booked THEN
    RAISE EXCEPTION 'This time slot was just booked. Please pick another.';
  END IF;

  reason_text := CASE
    WHEN NULLIF(trim(_reason), '') IS NULL THEN NULLIF(trim(_visit_type), '')
    ELSE concat_ws(': ', NULLIF(trim(_visit_type), ''), NULLIF(trim(_reason), ''))
  END;

  INSERT INTO public.appointments (patient_id, doctor_id, scheduled_at, reason, slot_id, created_by)
  VALUES (current_patient_id, slot_record.doctor_id, slot_record.starts_at, reason_text, slot_record.id, auth.uid())
  RETURNING id INTO appointment_id;

  UPDATE public.time_slots
  SET is_booked = true, appointment_id = appointment_id
  WHERE id = slot_record.id;

  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id,
         'New appointment booked',
         COALESCE(d.name, 'Doctor') || ' · ' || to_char(slot_record.starts_at, 'Mon DD, YYYY HH12:MI AM'),
         '/appointments',
         'appointment'
  FROM public.user_roles ur
  LEFT JOIN public.doctors d ON d.id = slot_record.doctor_id
  WHERE ur.role IN ('admin'::app_role, 'doctor'::app_role, 'staff'::app_role, 'user'::app_role);

  RETURN appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_doctor_day_slots(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_patient_appointment(uuid, text, text) TO authenticated;