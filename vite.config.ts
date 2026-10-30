import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths work for both root sites and GitHub project pages
// (https://USER.github.io/REPOSITORY/).
export default defineConfig({ base: './', plugins: [react()] })
