
-- Add color column to disciplinas
ALTER TABLE public.disciplinas ADD COLUMN IF NOT EXISTS cor text DEFAULT 'azul';

-- Add plan type and approval fields to planos_aula
ALTER TABLE public.planos_aula ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'normal';
ALTER TABLE public.planos_aula ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.planos_aula ADD COLUMN IF NOT EXISTS aprovado_por text;
ALTER TABLE public.planos_aula ADD COLUMN IF NOT EXISTS data_aprovacao timestamp with time zone;
ALTER TABLE public.planos_aula ADD COLUMN IF NOT EXISTS comentario_aprovacao text;
ALTER TABLE public.planos_aula ADD COLUMN IF NOT EXISTS habilidades text;
ALTER TABLE public.planos_aula ADD COLUMN IF NOT EXISTS objetivo_geral text;
