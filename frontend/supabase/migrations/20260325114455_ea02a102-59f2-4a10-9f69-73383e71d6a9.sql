ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS valor_total numeric DEFAULT 10;
ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS escola text;
ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS professor text;