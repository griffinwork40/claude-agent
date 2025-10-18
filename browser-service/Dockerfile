FROM node:20-slim

# Install Playwright system dependencies + VNC and X11 support
RUN apt-get update && apt-get install -y \
    chromium \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    # VNC and X11 dependencies
    xvfb \
    x11vnc \
    fluxbox \
    wget \
    unzip \
    python3 \
    python3-pip \
    # noVNC dependencies
    websockify \
    && rm -rf /var/lib/apt/lists/*

# Install noVNC
RUN cd /opt && \
    wget -qO- https://github.com/novnc/noVNC/archive/v1.4.0.tar.gz | tar xz --strip 1 && \
    cd /opt/utils && \
    wget -qO- https://github.com/novnc/websockify/archive/v0.10.0.tar.gz | tar xz --strip 1 && \
    chmod +x websockify

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev deps for build)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Set environment variables for Playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin

# Create directory for LinkedIn sessions
RUN mkdir -p /app/linkedin-sessions

# Expose ports
EXPOSE 3001 6080

CMD ["npm", "start"]

