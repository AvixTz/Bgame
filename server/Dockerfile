# Bgame data server. No npm dependencies: only Node's built-in http, crypto and sqlite.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production DATA_DIR=/data SOCKET_PATH=/run/bgame/api.sock
# runs as the unprivileged uid set in compose.yml (never root)
USER 10501
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD node -e "require('http').get({socketPath:process.env.SOCKET_PATH,path:'/api/health'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.mjs"]
