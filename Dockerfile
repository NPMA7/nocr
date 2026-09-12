FROM node:20-bookworm-slim

# Install dependency sistem untuk modul native (node-pty), Prisma, dan monitoring ping
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    python3 \
    make \
    g++ \
    gcc \
    dumb-init \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

ENV PORT=9371

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

# Buat folder runtime data
RUN mkdir -p backend/data

ENV NODE_ENV=production

EXPOSE 9371

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "backend/server.js"]
