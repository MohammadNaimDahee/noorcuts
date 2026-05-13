FROM node:20-bookworm-slim

# Install FFmpeg, Chromium, and dependencies for Remotion rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    chromium \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Tell Remotion to use system Chromium
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium

# Increase Node memory for Remotion bundling/rendering
ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the app
COPY . .

# Copy local data files (reciter DBs, quran.json)
COPY data/ ./data/

# Build Next.js
RUN npm run build

# Pre-bundle Remotion composition at build time to avoid slow runtime bundling
RUN node -e " \
  const { bundle } = require('@remotion/bundler'); \
  const path = require('path'); \
  bundle({ \
    entryPoint: path.join(process.cwd(), 'src/remotion/index.ts'), \
    publicDir: path.join(process.cwd(), 'public'), \
    webpackOverride: (config) => ({ \
      ...config, \
      resolve: { \
        ...config.resolve, \
        alias: { ...(config.resolve?.alias || {}), '@': path.join(process.cwd(), 'src') }, \
      }, \
    }), \
    outDir: path.join(process.cwd(), '.remotion-bundle'), \
  }).then(p => console.log('Remotion bundle ready:', p)).catch(e => { console.error(e); process.exit(1); }); \
"

# Create output directory
RUN mkdir -p output

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
