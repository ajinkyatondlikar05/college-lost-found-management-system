# Stage 1: Build production React application with Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies cleanly using lockfile
RUN npm ci

# Copy frontend source code (excluding items in .dockerignore)
COPY . .

# Build production bundle
RUN npm run build

# Stage 2: Serve static build with Nginx
FROM nginx:alpine

# Copy custom Nginx reverse proxy and SPA configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
