FROM node:20-bookworm-slim

# Install FFmpeg, Chromium dependencies for Remotion
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    chromium \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Tell Remotion/Puppeteer to use installed Chromium
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the app
COPY . .

# Copy local data files (reciter DBs, quran.json)
# These are needed for local data source rendering
COPY data/ ./data/

# Build Next.js
RUN npm run build

# Create output directory
RUN mkdir -p output

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
