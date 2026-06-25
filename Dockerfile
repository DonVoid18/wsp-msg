# Stage 1: Build
FROM node:20-slim AS builder

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar archivos de configuración y dependencias
COPY package.json pnpm-lock.yaml tsconfig.json ./

# Instalar todas las dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript a JavaScript
RUN pnpm build

# Stage 2: Production
FROM node:20-slim

# Evitar descargar el Chromium por defecto de Puppeteer para reducir tamaño
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Configurar la ruta de Chrome para el cliente de WhatsApp
ENV CHROME_PATH=/usr/bin/google-chrome-stable

# Instalar dependencias necesarias para Google Chrome y la ejecución de Puppeteer
RUN apt-get update && apt-get install -y wget gnupg curl ca-certificates --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-khmeros \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar package.json y pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Instalar solo dependencias de producción
RUN pnpm install --prod --frozen-lockfile

# Copiar la compilación del stage de build
COPY --from=builder /app/dist ./dist

# Copiar la demo y archivos necesarios
COPY demo.ts tsconfig.json ./

# Exponer el puerto de la API REST
EXPOSE 3000

# Persistencia de la sesión de WhatsApp
VOLUME ["/app/.wwebjs_auth"]

# Comando para ejecutar la API de producción
CMD ["pnpm", "start"]
