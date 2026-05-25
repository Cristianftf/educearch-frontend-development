# ============================================================
# Dockerfile - EDUCEARCH Frontend (Next.js)
# ============================================================
# Multi-stage build para producción:
#   1. Dependencies - Instala dependencias
#   2. Build - Compila la aplicación
#   3. Production - Imagen final optimizada
# ============================================================

# ---- Stage 1: Dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json* ./

# Instalar dependencias (solo producción)
RUN npm ci --only=production || npm install --production

# ---- Stage 2: Build ----
FROM node:22-alpine AS builder
WORKDIR /app

# Copiar dependencias desde stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables de entorno para el build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG BACKEND_INTERNAL_URL
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

# Compilar la aplicación
RUN npm run build

# ---- Stage 3: Production ----
FROM node:22-alpine AS runner
WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos necesarios para producción
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Configurar permisos
RUN chown -R nextjs:nodejs /app

# Usar usuario no-root
USER nextjs

# Variables de entorno para el runtime
ENV NODE_ENV=production
ENV PORT=3000

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Iniciar servidor
CMD ["node", "server.js"]