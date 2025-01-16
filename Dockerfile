FROM golang:latest

WORKDIR /app

COPY . .

# Copy fireBaseInfo.json into the Docker image
COPY fireBaseInfo.json /app/

RUN go mod download

RUN go build -o main .

EXPOSE 8088

CMD ["/app/main"]