# Single-stage build — installs all deps (build needs vite/esbuild/tsx),
# builds the client + server bundle, then runs the server which also serves
# the static client. One container, one origin.
FROM node:20-slim

WORKDIR /app

# Install dependencies (including devDependencies needed for the build)
COPY package.json package-lock.json* ./
RUN npm install

# Build client (dist/public) + server bundle (dist/index.cjs)
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "dist/index.cjs"]
