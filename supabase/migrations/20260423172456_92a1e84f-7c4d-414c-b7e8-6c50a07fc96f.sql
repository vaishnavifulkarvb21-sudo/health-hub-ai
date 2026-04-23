
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select all auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Patients
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INT NOT NULL,
  gender TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients all auth select" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "patients all auth insert" ON public.patients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "patients all auth update" ON public.patients FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "patients admin delete" ON public.patients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- Visits
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  symptoms TEXT,
  diagnosis TEXT,
  prescription TEXT,
  doctor_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visits select" ON public.visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "visits insert" ON public.visits FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "visits update" ON public.visits FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "visits delete" ON public.visits FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid',
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments select" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "payments update" ON public.payments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "payments delete" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- Lab Reports
CREATE TABLE public.lab_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab select" ON public.lab_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "lab insert" ON public.lab_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "lab update" ON public.lab_reports FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "lab delete" ON public.lab_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- Storage bucket for lab reports
INSERT INTO storage.buckets (id, name, public) VALUES ('lab-reports', 'lab-reports', true);

CREATE POLICY "lab files public read" ON storage.objects FOR SELECT USING (bucket_id = 'lab-reports');
CREATE POLICY "lab files auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lab-reports');
CREATE POLICY "lab files auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lab-reports');
CREATE POLICY "lab files auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lab-reports');

-- Trigger to create profile on signup, default role = user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
