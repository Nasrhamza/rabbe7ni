FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps/admin-web/package.json apps/admin-web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/admin-web ./apps/admin-web
COPY eslint.config.mjs ./
RUN pnpm nx build admin-web

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=build /workspace/apps/admin-web/.next/standalone ./
COPY --from=build /workspace/apps/admin-web/.next/static ./apps/admin-web/.next/static
COPY --from=build /workspace/apps/admin-web/public ./apps/admin-web/public

USER node
EXPOSE 3000
CMD ["node", "apps/admin-web/server.js"]
