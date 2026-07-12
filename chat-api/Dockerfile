FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4001
# db push, not migrate deploy — decisions-log.md B5: chat-api's ChatbotMessage
# table lives in its own "chat" Postgres schema (multiSchema), separate from
# core-api's "public" schema in the same Neon database. No --accept-data-loss:
# a genuinely destructive change fails the deploy loudly instead of silently
# dropping data.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
