FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY eslint.config.mjs .prettierrc.json ./

RUN pnpm db:generate && pnpm nx build api
RUN pnpm --filter @rabbehni/api deploy --prod --legacy /runtime
RUN cp -R /workspace/dist /runtime/dist

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /runtime ./

USER node
EXPOSE 4000
CMD ["node", "dist/apps/api/main.js"]
