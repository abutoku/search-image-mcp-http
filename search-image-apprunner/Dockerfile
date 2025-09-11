# Use Node.js 20 Alpine base image for smaller size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy application code
COPY . .

# Build TypeScript code
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# Expose port 8080 (App Runner default)
EXPOSE 8080

# Start the server
CMD ["node", "dist/server.js"]