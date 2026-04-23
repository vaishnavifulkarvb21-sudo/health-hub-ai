
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

DROP POLICY IF EXISTS "lab files public read" ON storage.objects;
CREATE POLICY "lab files auth list" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lab-reports');
