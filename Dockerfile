FROM ubuntu:latest

RUN apt-get update && \
    apt-get install -y ca-certificates curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    npm install pm2 -g

#WORKDIR /app

COPY . .

RUN npm install

EXPOSE 8080

CMD ["pm2-runtime", "start", "main.js", "-i", "max", "--name", "genesis-backend"]