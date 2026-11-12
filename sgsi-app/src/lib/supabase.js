import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  // Ajuda a diagnosticar configuracao faltando
  console.error('Variaveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nao definidas (.env)')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})
