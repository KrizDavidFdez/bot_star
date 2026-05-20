# Cambiar de node:18-slim a node:20-slim o node:22-slim
FROM node:20-slim

# Instalar ffmpeg y dependencias
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 8000

CMD ["node", "main.js"]
