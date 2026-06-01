FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
ARG VITE_BASE=/million-records-test-task/
ENV VITE_BASE=$VITE_BASE
COPY . .
RUN npm run build

FROM node:22-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV API_ONLY=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server/index.js"]

FROM nginx:1.27-alpine AS nginx
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client /usr/share/nginx/html
EXPOSE 80
