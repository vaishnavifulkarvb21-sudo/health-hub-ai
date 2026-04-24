DROP POLICY IF EXISTS "patients admin delete" ON public.patients;
CREATE POLICY "patients authenticated delete"
ON public.patients
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "visits delete" ON public.visits;
CREATE POLICY "visits authenticated delete"
ON public.visits
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "payments delete" ON public.payments;
CREATE POLICY "payments authenticated delete"
ON public.payments
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "lab delete" ON public.lab_reports;
CREATE POLICY "lab authenticated delete"
ON public.lab_reports
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);