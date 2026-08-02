FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps/merchant-web/package.json apps/merchant-web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/merchant-web ./apps/merchant-web
COPY eslint.config.mjs ./
RUN pnpm nx build merchant-web

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3002
WORKDIR /app

COPY --from=build /workspace/apps/merchant-web/.next/standalone ./
COPY --from=build /workspace/apps/merchant-web/.next/static ./apps/merchant-web/.next/static
COPY --from=build /workspace/apps/merchant-web/public ./apps/merchant-web/public

USER node
EXPOSE 3002
CMD ["node", "apps/merchant-web/server.js"]
