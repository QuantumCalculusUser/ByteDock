import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Actions provides /REPOSITORY/ for project Pages and / for user Pages.
// The relative fallback also supports local preview deployments.
export default defineConfig({ base: process.env.VITE_BASE_PATH || './', plugins: [react()] })
