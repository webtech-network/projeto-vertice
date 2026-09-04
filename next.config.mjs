import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This tool lives inside a larger monorepo-like folder with its own
  // package-lock.json at the repo root; pin the workspace root explicitly so
  // Next.js doesn't have to guess which lockfile scopes this project.
  turbopack: {
    root: __dirname,
  },
  // Emite .next/standalone (server + node_modules mínimos, traçados a partir
  // dos imports reais) — é o que o Dockerfile copia pro estágio final, bem
  // mais enxuto que copiar node_modules inteiro pra imagem.
  output: 'standalone',
};

export default nextConfig;
