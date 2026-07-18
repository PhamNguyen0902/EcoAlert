FROM node:20-alpine AS builder

WORKDIR /app

# Copy the entire backend workspace
COPY . .

# Install dependencies for shared first
WORKDIR /app/shared
RUN npm install
RUN npm run build

# Go back to the specific service
ARG SERVICE_NAME
WORKDIR /app/${SERVICE_NAME}

# Install dependencies. Because of local file:../shared, this will link to the built shared package
RUN npm install
RUN npm run build

# Final lightweight image
FROM node:20-alpine
ARG SERVICE_NAME

WORKDIR /app
# We need to copy the shared package for runtime because of local dependency resolution
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/${SERVICE_NAME} /app/${SERVICE_NAME}

WORKDIR /app/${SERVICE_NAME}

# Expose standard port (can be overridden by docker-compose)
EXPOSE 3000 3001 3002 3003 3004 3005 3006

CMD ["npm", "start"]
