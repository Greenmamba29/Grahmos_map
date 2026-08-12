# Multi-stage build for Resilience Maps SPA + static PMTiles

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ARG VITE_PMTILES_URL=/tiles/region.pmtiles
ARG VITE_DEFAULT_CENTER_LNG=-104.9903
ARG VITE_DEFAULT_CENTER_LAT=39.7392
ARG VITE_DEFAULT_ZOOM=11
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_PMTILES_URL=$VITE_PMTILES_URL \
    VITE_DEFAULT_CENTER_LNG=$VITE_DEFAULT_CENTER_LNG \
    VITE_DEFAULT_CENTER_LAT=$VITE_DEFAULT_CENTER_LAT \
    VITE_DEFAULT_ZOOM=$VITE_DEFAULT_ZOOM
RUN npm run build

FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
# Optional: bake local tiles into the image
COPY public/tiles /usr/share/nginx/html/tiles
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
