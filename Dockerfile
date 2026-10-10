FROM node:22-slim

ENV NODE_ENV=production
ENV PORT=7860

WORKDIR /app

COPY package.json ./package.json
COPY server.js ./server.js
COPY public ./public

EXPOSE 7860

CMD ["npm", "start"]
