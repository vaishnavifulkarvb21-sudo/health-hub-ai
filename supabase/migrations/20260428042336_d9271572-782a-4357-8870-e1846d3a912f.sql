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
  new_appointment_id uuid;
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
  RETURNING id INTO new_appointment_id;

  UPDATE public.time_slots
  SET is_booked = true, appointment_id = new_appointment_id
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

  RETURN new_appointment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_patient_appointment(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.book_patient_appointment(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.book_patient_appointment(uuid, text, text) TO authenticated;