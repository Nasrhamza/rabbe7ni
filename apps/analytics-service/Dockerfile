FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps/analytics-service/package.json apps/analytics-service/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

COPY apps/analytics-service ./apps/analytics-service
COPY eslint.config.mjs ./
RUN pnpm nx build analytics-service

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/dist/apps/analytics-service ./dist/apps/analytics-service
COPY --from=build /workspace/packages ./packages
COPY package.json ./

USER node
EXPOSE 4100
CMD ["node", "dist/apps/analytics-service/main.js"]
