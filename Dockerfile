FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (only what relay-server.js needs)
RUN npm install --omit=dev

# Copy relay server
COPY relay-server.js ./

# Create directory for Gun.js data
RUN mkdir -p radata-relay

# Expose port
EXPOSE 7860

# Set environment variable for Hugging Face Spaces
ENV PORT=7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:7860/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the relay server
CMD ["node", "relay-server.js"]
