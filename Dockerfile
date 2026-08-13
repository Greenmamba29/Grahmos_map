# syntax=docker/dockerfile:1
# Multi-stage: Node builds the SPA, nginx serves it. Tile archives are mounted
# at runtime rather than baked in — they change on a different cadence.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js ./
COPY public ./public
COPY src ./src

# Build-time public config. Pass `--build-arg VITE_SUPABASE_URL=…` to point at a live registry.
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ARG VITE_BASEMAP_PMTILES_URL=/tiles/region.pmtiles
ARG VITE_TERRAIN_PMTILES_URL=/tiles/terrain.pmtiles
ARG VITE_FALLBACK_RASTER_TILES_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ARG VITE_DEFAULT_CENTER=-72.3350,18.5392
ARG VITE_DEFAULT_ZOOM=12

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_BASEMAP_PMTILES_URL=$VITE_BASEMAP_PMTILES_URL \
    VITE_TERRAIN_PMTILES_URL=$VITE_TERRAIN_PMTILES_URL \
    VITE_FALLBACK_RASTER_TILES_URL=$VITE_FALLBACK_RASTER_TILES_URL \
    VITE_DEFAULT_CENTER=$VITE_DEFAULT_CENTER \
    VITE_DEFAULT_ZOOM=$VITE_DEFAULT_ZOOM

RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Placeholder so the /tiles mount has somewhere to land if the volume is empty.
RUN mkdir -p /usr/share/nginx/html/tiles
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
