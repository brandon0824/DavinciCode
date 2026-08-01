FROM node:18-bullseye

# Install PostgreSQL, postgresql-contrib, and sudo
RUN apt-get update && \
    apt-get install -y postgresql postgresql-contrib sudo && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package dependency manifests
COPY package*.json ./

# Install project dependencies
RUN npm ci

# Copy project files
COPY . .

# Build Next.js project
RUN npm run build

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

# Expose Next.js default port
EXPOSE 3000

# Set entrypoint to manage database startup and Next.js startup
ENTRYPOINT ["/bin/bash", "./entrypoint.sh"]
```
