FROM node:24-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM golang:1.26-alpine AS backend
WORKDIR /build
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/shepherd .

FROM alpine:3.23
RUN apk add --no-cache ca-certificates wget \
    && addgroup -S -g 10001 flock \
    && adduser -S -D -H -u 10001 -G flock flock \
    && mkdir -p /app/data \
    && chown flock:flock /app/data
WORKDIR /app
COPY --from=backend /out/shepherd ./shepherd
COPY --from=frontend /build/dist ./dist
ENV PORT=8080 STATIC_DIR=/app/dist SAVE_PATH=/app/data/farm.json
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1
ENTRYPOINT ["/app/shepherd"]
