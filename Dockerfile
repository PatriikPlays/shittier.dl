FROM oven/bun:1.0.11-distroless
WORKDIR /usr/src/app
COPY package.json bun.lockb src ./
RUN bun install
RUN bun run start
