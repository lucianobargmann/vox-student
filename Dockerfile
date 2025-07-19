# Multi-stage build for Next.js application
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
# Install all dependencies (including dev) for the build stage
RUN npm ci

# Rebuild the source code only when needed
FROM deps AS builder
WORKDIR /app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Copy QA environment file for build if NODE_ENV is qa
ARG NODE_ENV=production
COPY .env.qa.production* ./
RUN if [ "$NODE_ENV" = "qa" ] ; then cp .env.qa.production .env.production ; fi

# Build the application
RUN npm run build

# Production dependencies stage - clean install with only production deps
FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the public folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files and production dependencies
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prod-deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=prod-deps /app/node_modules/prisma ./node_modules/prisma

# Copy entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

# Allow port override for different environments
ARG PORT=3000
ENV PORT=$PORT
ENV HOSTNAME="0.0.0.0"

EXPOSE $PORT

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
