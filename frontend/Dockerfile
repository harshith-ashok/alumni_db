# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# Vite inlines VITE_* at build time, so they must be build args (none of these are secrets)
ARG VITE_DATA_SOURCE=mock
ARG VITE_APPS_SCRIPT_URL=
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_DATA_SOURCE=$VITE_DATA_SOURCE \
    VITE_APPS_SCRIPT_URL=$VITE_APPS_SCRIPT_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# ---- serve ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

# ---- dev (hot reload; used by compose profile "dev") ----
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
