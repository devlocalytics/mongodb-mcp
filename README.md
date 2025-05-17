# mongo-mcp

A Model Context Protocol (MCP) server for MongoDB operations, using stdio for communication.

This server exposes tools to perform Create, Read, Update, and Delete (CRUD) operations on a MongoDB server, as well as tools for listing databases and collections. It is designed to be run with the MongoDB connection URL provided as a command-line argument or environment variable.

## Prerequisites

- Node.js (v20 or later recommended, as used in Dockerfile)
- npm
- A running MongoDB instance
- Docker (for containerized deployment)

## Setup and Running Locally

1.  **Clone the repository (if applicable) and navigate to the `mongo-mcp` directory.**

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Build the TypeScript Code:**
    ```bash
    npm run build
    ```

4.  **Run the Server:**
    Provide the MongoDB connection URL as the first argument after `node dist/index.js`:
    ```bash
    node dist/index.js "your_mongodb_connection_string"
    ```
    Example:
    ```bash
    node dist/index.js "mongodb://localhost:27017/mydatabase"
    ```
    Alternatively, you can set the `MONGO_URL` environment variable, which the server will use if no command-line argument is provided:
    ```bash
    export MONGO_URL="mongodb://localhost:27017/mydatabase"
    node dist/index.js
    ```

## Running with Docker

1.  **Build the Docker Image:**
    From the `mongo-mcp` directory:
    ```bash
    docker build -t mongo-mcp-server .
    ```

2.  **Run the Docker Container:**
    Provide the MongoDB connection URL as a command-line argument to the container after the image name. 
    If your MongoDB is running on the host machine (e.g., `localhost`), use `host.docker.internal` (on Docker Desktop for Mac/Windows) or your host's network IP address for the MongoDB host in the connection string.

    ```bash
    docker run -i --rm mongo-mcp-server "your_mongodb_connection_string"
    ```
    Example (connecting to MongoDB on host from Docker Desktop):
    ```bash
    docker run -i --rm mongo-mcp-server "mongodb://host.docker.internal:27017/mydatabase"
    ```
    Example (connecting to a remote MongoDB):
    ```bash
    docker run -i --rm mongo-mcp-server "mongodb://user:password@remote_mongo_host:27017/mydatabase"
    ```
    The `-i` flag is crucial for stdio communication.

## MCP Configuration (e.g., for `.cursor/mcp.json`)

To use this server with an MCP client like Cursor, you can add a configuration to your `mcp.json` file (typically located in `.cursor/mcp.json` in your workspace). Below are examples for running the server locally and via Docker.

**General Structure for `.cursor/mcp.json`:**

```json
{
  "mcpServers": {
    // ... other server configurations ...

    "my_mongodb_server_local": {
      "command": "node",
      "args": [
        "/full/path/to/your/mongo-mcp/dist/index.js", // <-- IMPORTANT: Update this path
        "mongodb://localhost:27017/your_default_database" // <-- Update MongoDB URL
      ],
      "transport": "stdio",
      "notes": "MongoDB server running locally via node."
    },

    "my_mongodb_server_docker": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "mongo-mcp-server", // Assumes image is built with this tag
        "mongodb://host.docker.internal:27017/your_default_database" // <-- Update MongoDB URL
      ],
      "transport": "stdio",
      "notes": "MongoDB server running via Docker. Adjust DB URL for non-Docker Desktop or remote DBs."
    }
    // ... possibly more server configurations ...
  }
}
```

**Instructions for adding to your `mcp.json`:**

1.  **Choose a name** for your server configuration (e.g., `my_mongodb_server_local` or `mongo_dev`).
2.  **Decide on the execution method** (local `node` or `docker`).
3.  **Copy the relevant example** into the `mcpServers` object in your `.cursor/mcp.json`.
4.  **Update placeholders:**
    *   For local execution, change `/full/path/to/your/mongo-mcp/dist/index.js` to the correct absolute path on your system.
    *   For both, update the MongoDB connection string (`"mongodb://..."`) to point to your desired MongoDB instance and database.

## Available Tools

The server exposes the following tools (tool names are exact):

-   `list_databases`: Lists all databases in the MongoDB instance.
    -   Input: (No parameters)
-   `list_collections`: Lists all collections in a specified database.
    -   Input: `{ "databaseName": "string" }`
-   `find_documents`: Finds documents in a collection.
    -   Input: `{ "databaseName": "string", "collectionName": "string", "query": { ... } (optional), "projection": { ... } (optional), "limit": number (optional), "skip": number (optional), "sort": { ... } (optional) }`
-   `insert_document`: Inserts a single document into a collection.
    -   Input: `{ "databaseName": "string", "collectionName": "string", "document": { ... } }`
-   `update_document`: Updates a single document matching the filter.
    -   Input: `{ "databaseName": "string", "collectionName": "string", "filter": { ... }, "update": { ... } }`
-   `delete_document`: Deletes a single document matching the filter.
    -   Input: `{ "databaseName": "string", "collectionName": "string", "filter": { ... } }`

## Development

-   Run in development mode (uses `tsx` for live reloading TypeScript execution):
    ```bash
    npm run dev -- "your_mongodb_connection_string"
    ```
    (The `--` ensures arguments are passed to the `tsx` script. If no MongoDB URL is provided as an argument, it will look for the `MONGO_URL` environment variable.)

## Publishing (Hypothetical NPX Command)

If this package were published to npm (e.g., as `mongodb-mcp`, based on `package.json`), an `npx` command might look like this in an MCP configuration:

```json
{
  "mcpServers": {
    "mongo_published_npm": {
      "command": "npx",
      "args": [
        "-y", // Or --yes, to auto-confirm npx execution if needed
        "mongodb-mcp", // Package name from npm
        "mongodb://localhost:27017/mydatabase" // Argument for the MongoDB URL
      ],
      "transport": "stdio"
    }
  }
}
```
This server is not currently configured for publishing, but this illustrates a potential pattern if it were.
