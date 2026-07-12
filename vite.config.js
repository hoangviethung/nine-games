import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load every env var (no prefix filter) from .env files and process.env.
  // This lets us bridge the Supabase–Vercel integration vars (SUPABASE_URL,
  // SUPABASE_ANON_KEY), which are NOT VITE_-prefixed and so aren't exposed to
  // client code by default.
  const env = loadEnv(mode, process.cwd(), '')

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || ''

  return {
    plugins: [react()],
    server: { port: 5180 },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
    },
  }
})
