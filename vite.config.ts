import { defineConfig } from 'vite'

// base relativa: funciona en https://<usuario>.github.io/guia-diocesana-interactiva/ y dentro de un iframe
export default defineConfig({ base: './', build: { outDir: 'dist', sourcemap: false } })
