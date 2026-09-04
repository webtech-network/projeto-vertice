# syntax=docker/dockerfile:1

# Build multi-stage do app Next.js (Vértice). Não empacota o CLI (npm run
# cli) nem RubricTool/ct/ — fora de escopo, seguem rodando fora do Docker.
# A infra Supabase tem seu próprio Dockerfile via imagens oficiais, ver
# supabase/docker-compose.yml; este Dockerfile é só do serviço `app`.

FROM node:22-alpine AS deps
# Recomendação padrão do Next para Alpine — evita erros de resolução de libc
# em dependências nativas que algum pacote transitivo possa trazer no futuro.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* são embutidas no bundle do browser em build time, não lidas
# em runtime — por isso viram ARG aqui em vez de só `environment:` no
# docker-compose.yml (que só afetaria o processo em runtime, tarde demais).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_PASSKEYS_ENABLED
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_PASSKEYS_ENABLED=$NEXT_PUBLIC_PASSKEYS_ENABLED
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Lida via process.cwd() em runtime por src/app/api/skills/enade-it-questions/route.js
# (zip on-demand) — não é asset processado pelo build do Next, precisa de cópia explícita.
COPY --from=builder --chown=nextjs:nodejs /app/skills ./skills

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
