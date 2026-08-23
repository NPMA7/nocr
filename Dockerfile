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

# Salin dependencies list
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (termasuk devDependencies sementara untuk proses build Next.js)
RUN npm install --include=dev

# Generate Prisma Client ke output yang ditentukan
RUN npx prisma generate

# Salin kode aplikasi
COPY . .

# Build Next.js dashboard
RUN npm run build

# Buat folder data dan auth WhatsApp jika belum ada
RUN mkdir -p data .wwebjs_auth

ENV NODE_ENV=production

EXPOSE 9371

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
