FROM node:20-bookworm-slim

# Install dependency sistem untuk Chromium (WhatsApp-Web.js / Puppeteer), modul native (node-pty), dan Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgbm1 \
    libasound2 \
    fonts-liberation \
    ca-certificates \
    openssl \
    python3 \
    make \
    g++ \
    gcc \
    dumb-init \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Konfigurasi environment Puppeteer agar menggunakan Chromium sistem bawaan container
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=9371

WORKDIR /app

# 1. Install dependencies backend & generate Prisma
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
RUN cd backend && npm install --include=dev && npx prisma generate

# 2. Install dependencies frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --include=dev

# 3. Salin source code
COPY . .

# 4. Build Next.js dashboard di frontend
RUN cd frontend && npm run build

# Buat folder runtime data dan WhatsApp auth
RUN mkdir -p backend/data backend/.wwebjs_auth

ENV NODE_ENV=production

EXPOSE 9371

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "backend/server.js"]
