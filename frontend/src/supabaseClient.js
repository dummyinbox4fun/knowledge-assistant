import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// null when the two env vars are not set. The app then runs without a login
// screen (same as before V3.2), which keeps local development easy.
export const supabase = url && key ? createClient(url, key) : null
