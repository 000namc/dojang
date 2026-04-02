FROM docker:27-cli

RUN apk add --no-cache bash curl jq

# Create sample Dockerfiles for practice
RUN mkdir -p /workspace/examples

RUN cat > /workspace/examples/Dockerfile.simple <<'DEOF'
FROM alpine:3.19
RUN echo "hello from container" > /message.txt
CMD ["cat", "/message.txt"]
DEOF

RUN cat > /workspace/examples/Dockerfile.web <<'DEOF'
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/
EXPOSE 80
DEOF

RUN echo "<h1>Hello Docker</h1>" > /workspace/examples/index.html

RUN cat > /workspace/examples/docker-compose.yml <<'DEOF'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
  redis:
    image: redis:alpine
DEOF

WORKDIR /workspace
CMD ["tail", "-f", "/dev/null"]
