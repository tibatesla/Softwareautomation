# Stage 1: Build & Compile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package configurations and install ALL dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code and compile TypeScript to JavaScript
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment to production for optimal Express performance
ENV NODE_ENV="production"

# Install ONLY production dependencies to minimize attack surface and image size
COPY package*.json ./
RUN npm ci --omit=dev

# Copy only the compiled JavaScript from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 3000

# Execute the compiled server
CMD ["node", "dist/server.js"]