FROM oven/bun:1

# LibreOffice headless : moteur de conversion ponctuel pour la déclaration statistique MINESEC
# (backend/src/application/statisticalCampaign/xlsEngine.ts). --no-install-recommends évite
# ~500 Mo de paquets inutiles (aides, traductions) ; libreoffice-calc suffit, pas la suite complète.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-calc \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["bun", "run", "src/server.ts"]
