FROM node:22-bookworm

# Install PostgreSQL, postgresql-contrib, and sudo
RUN apt-get update && \
    apt-get install -y postgresql postgresql-contrib sudo && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package dependency manifests
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy project files
COPY . .

# Build Next.js project
RUN npm run build

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

# Expose Next.js port 60824
ENV PORT=60824
EXPOSE 60824

# Set entrypoint to manage database startup and Next.js startup
ENTRYPOINT ["/bin/bash", "./entrypoint.sh"]
