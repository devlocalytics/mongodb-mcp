# Use an official Node.js runtime as a parent image
FROM node:20-alpine as builder

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install app dependencies
# Ensure npm install uses the version of the SDK that exists
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy built application and essential package files
COPY --from=builder /usr/src/app/dist ./dist
COPY package*.json ./
COPY package-lock.json ./

# Install production dependencies using npm ci for a clean and reproducible install
RUN npm ci --omit=dev

# The MONGO_URL will be passed as a command-line argument to the entrypoint
# or can be set as an environment variable when running the container.
# The PORT is not needed as we are using stdio.

# Command to run the application
ENTRYPOINT ["node", "dist/index.js"] 