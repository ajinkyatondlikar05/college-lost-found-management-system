FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies cleanly using lockfile
RUN npm ci

# Copy backend source code (excluding items in .dockerignore)
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

# Expose backend port
EXPOSE 5000

# Set production environment flag
ENV NODE_ENV=production

# Start backend server
CMD ["node", "server.js"]
