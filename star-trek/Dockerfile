# Production-ready Dockerfile for Next.js app
FROM node:20-alpine as builder
WORKDIR /app
COPY . .
RUN npm install
RUN apt-get update && apt-get install -y curl wget
RUN npm run build

FROM node:20-alpine as runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
