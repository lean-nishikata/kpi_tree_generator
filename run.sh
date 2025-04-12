#!/bin/bash

# Check if docker and docker-compose are installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to run this application."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose to run this application."
    exit 1
fi

# Build and run the container
echo "Building and running KPI Tree Generator..."
docker-compose up --build

echo "Done! Check the output directory for your generated KPI tree HTML file."