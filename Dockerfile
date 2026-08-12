FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PMTILES_URL=/tiles/region.pmtiles
ARG VITE_MAP_DEFAULT_CENTER=-105.2705,40.0150
ARG VITE_MAP_DEFAULT_ZOOM=12

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_PMTILES_URL=$VITE_PMTILES_URL
ENV VITE_MAP_DEFAULT_CENTER=$VITE_MAP_DEFAULT_CENTER
ENV VITE_MAP_DEFAULT_ZOOM=$VITE_MAP_DEFAULT_ZOOM

RUN npm run build

FROM nginx:alpine

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN mkdir -p /usr/share/nginx/html/tiles

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
