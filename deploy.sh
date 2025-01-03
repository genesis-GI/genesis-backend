#!/bin/bash

# Variables
REGISTRY_IP="192.168.1.165:32768"
IMAGE_NAME="cloudmesh_backend"
LATEST_TAG="latest"
SERVER_USER="lukas"
SERVER_IP="192.168.1.165"
CONTAINER_NAME="cloudmesh_backend"

# Build multi-arch images
echo "Building multi-arch image..."
docker buildx create --use || echo "Using existing buildx builder..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ${REGISTRY_IP}/${IMAGE_NAME}:${LATEST_TAG} \
  --push .

if [ $? -ne 0 ]; then
  echo "Error: Failed to build and push the image."
  exit 1
fi

# SSH into the server
echo "Deploying on the server..."
ssh ${SERVER_USER}@${SERVER_IP} << EOF
  # Ensure user has Docker permissions
  if ! groups | grep -q docker; then
    echo "Error: User 'lukas' is not in the 'docker' group."
    exit 1
  fi

  # Stop and remove old container
  echo "Stopping and removing old container..."
  docker ps -q --filter "name=${CONTAINER_NAME}" | xargs -r docker stop
  docker ps -a -q --filter "name=${CONTAINER_NAME}" | xargs -r docker rm

  # Pull the new image
  echo "Pulling the new image..."
  docker pull ${REGISTRY_IP}/${IMAGE_NAME}:${LATEST_TAG}

  if [ $? -ne 0 ]; then
    echo "Error: Failed to pull the image."
    exit 1
  fi

  # Run the new container
  echo "Running the new container..."
  docker run -d --restart=always --name ${CONTAINER_NAME} ${REGISTRY_IP}/${IMAGE_NAME}:${LATEST_TAG}
EOF

if [ $? -eq 0 ]; then
  echo "Deployment complete!"
else
  echo "Deployment failed!"
  exit 1
fi
