FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm install --omit=dev && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://localhost:${PORT:-5000}/api/ping || exit 1
CMD ["node", "src/server.js"]
