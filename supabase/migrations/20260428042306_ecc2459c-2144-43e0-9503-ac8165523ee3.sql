REVOKE EXECUTE ON FUNCTION public.get_or_create_doctor_day_slots(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_doctor_day_slots(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_doctor_day_slots(uuid, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.book_patient_appointment(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.book_patient_appointment(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.book_patient_appointment(uuid, text, text) TO authenticated;