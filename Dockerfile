FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_MAP_PM_TILES_URL=/tiles/region.pmtiles
ARG VITE_TERRAIN_PM_TILES_URL=/tiles/terrain.pmtiles
ARG VITE_SATELLITE_PM_TILES_URL=/tiles/satellite.pmtiles

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_MAP_PM_TILES_URL=$VITE_MAP_PM_TILES_URL \
    VITE_TERRAIN_PM_TILES_URL=$VITE_TERRAIN_PM_TILES_URL \
    VITE_SATELLITE_PM_TILES_URL=$VITE_SATELLITE_PM_TILES_URL

RUN npm run build

FROM nginx:1.29-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
