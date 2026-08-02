FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps/notification-worker/package.json apps/notification-worker/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

COPY apps/notification-worker ./apps/notification-worker
COPY eslint.config.mjs ./
RUN pnpm nx build notification-worker

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/dist/apps/notification-worker ./dist/apps/notification-worker
COPY --from=build /workspace/packages ./packages
COPY package.json ./

USER node
EXPOSE 4101
CMD ["node", "dist/apps/notification-worker/main.js"]
