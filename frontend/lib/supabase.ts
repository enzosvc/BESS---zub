import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// A anon key é segura para expor no frontend — ela só permite o que as
// políticas de RLS do Supabase autorizarem (ver supabase/schema.sql).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
