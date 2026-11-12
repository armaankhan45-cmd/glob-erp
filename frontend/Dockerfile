FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm install && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:5173/ || exit 1
CMD ["npm", "run", "dev", "--", "--host"]
