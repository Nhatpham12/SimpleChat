FROM node:22-slim
WORKDIR /app
COPY package*.json .npmrc ./

RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 5001
CMD [ "node", "index.js" ]
