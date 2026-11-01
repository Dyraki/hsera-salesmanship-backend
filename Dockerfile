FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 5003

CMD ["sh", "-c", "npx prisma generate && npm run dev"]
