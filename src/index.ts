// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MongoClient, Db } from "mongodb";
import { z } from "zod";

const mongoUrl = process.argv[2] || process.env.MONGO_URL;

if (!mongoUrl) {
    console.error("MongoDB URL is required. Provide it as a command-line argument or set MONGO_URL environment variable.");
    process.exit(1);
}

const client = new MongoClient(mongoUrl);
let db: Db; // To be initialized after connection

// Add MongoDB client event listeners
client.on('open', () => console.error('[MongoDB] Connection event: open'));
client.on('close', () => console.error('[MongoDB] Connection event: close'));
client.on('error', (err) => console.error('[MongoDB] Connection event: error', err));
client.on('timeout', (type: any) => console.error(`[MongoDB] Connection event: timeout - ${type}`));
client.on('connectionPoolCreated', (event) => console.error('[MongoDB] Connection Pool event: created', event.address));
client.on('connectionPoolReady', (event) => console.error('[MongoDB] Connection Pool event: ready', event.address));
client.on('connectionPoolClosed', (event) => console.error('[MongoDB] Connection Pool event: closed', event.address));
client.on('connectionCreated', (event) => console.error('[MongoDB] Connection Pool Connection event: created', event.address, event.connectionId));
client.on('connectionReady', (event) => console.error('[MongoDB] Connection Pool Connection event: ready', event.address, event.connectionId));
client.on('connectionClosed', (event) => console.error('[MongoDB] Connection Pool Connection event: closed', event.address, event.connectionId, event.reason));
client.on('connectionCheckOutStarted', (event) => console.error('[MongoDB] Connection Pool Connection event: checkout started for address', event.address));
client.on('connectionCheckOutFailed', (event) => console.error('[MongoDB] Connection Pool Connection event: checkout failed for address', event.address, event.reason));
client.on('connectionCheckedOut', (event) => console.error('[MongoDB] Connection Pool Connection event: checked out from address', event.address, event.connectionId));
client.on('connectionCheckedIn', (event) => console.error('[MongoDB] Connection Pool Connection event: checked in for address', event.address, event.connectionId));
client.on('serverHeartbeatStarted', (event) => console.error(`[MongoDB] Heartbeat event: started for ${event.connectionId}`));
client.on('serverHeartbeatSucceeded', (event) => console.error(`[MongoDB] Heartbeat event: succeeded for ${event.connectionId}`));
client.on('serverHeartbeatFailed', (event) => console.error(`[MongoDB] Heartbeat event: failed for ${event.connectionId}`, event.failure));

async function connectToMongo() {
    console.error("Connecting to MongoDB...");
    try {
        await client.connect();
        console.error("MongoDB client connected.");
        db = client.db(); // 'db' instance created, though tools often use client.db(name)
        console.error("MongoDB default database instance obtained.");
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        process.exit(1);
    }
}

const server = new McpServer({
    name: "MongoDB MCP",
    description: "MongoDB MCP",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  });
  

server.tool(
    "list_databases",
    "List all databases",
    z.object({}).shape,
    async () => {
        const databases = await client.db().admin().listDatabases();
        const dbNames = databases.databases.map((db: { name: string }) => db.name);
        return { content: [{ type: "text", text: JSON.stringify(dbNames) }] };
    }
);

server.tool(
    "list_collections",
    "List all collections in a specified database",
    z.object({
        databaseName: z.string().describe("Name of the database"),
    }).shape,
    async ({ databaseName }) => {
        const collections = await client.db(databaseName).listCollections().toArray();
        const colNames = collections.map((col: { name: string }) => col.name);
        return { content: [{ type: "text", text: JSON.stringify(colNames) }] };
    }
);

server.tool(
    "find_documents",
    "Find documents in a collection",
    z.object({
        databaseName: z.string().describe("Name of the database"),
        collectionName: z.string().describe("Name of the collection"),
        query: z.record(z.any()).optional().describe("Query filter object (MongoDB syntax)"),
        projection: z.record(z.any()).optional().describe("Projection object (MongoDB syntax)"),
        limit: z.number().optional().describe("Maximum number of documents to return"),
        skip: z.number().optional().describe("Number of documents to skip"),
        sort: z.record(z.any()).optional().describe("Sort order (MongoDB syntax)"),
    }).shape,
    async ({ databaseName, collectionName, query = {}, projection, limit, skip, sort }) => {
        const collection = client.db(databaseName).collection(collectionName);
        let cursor = collection.find(query);
        if (projection) {
            cursor = cursor.project(projection);
        }
        if (sort) {
            cursor = cursor.sort(sort);
        }
        if (skip) {
            cursor = cursor.skip(skip);
        }
        if (limit) {
            cursor = cursor.limit(limit);
        }
        const documents = await cursor.toArray();
        return { content: [{ type: "text", text: JSON.stringify(documents) }] };
    }
);

server.tool(
    "insert_document",
    "Insert a single document into a collection",
    z.object({
        databaseName: z.string().describe("Name of the database"),
        collectionName: z.string().describe("Name of the collection"),
        document: z.record(z.any()).describe("Document to insert"),
    }).shape,
    async ({ databaseName, collectionName, document }) => {
        const result = await client.db(databaseName).collection(collectionName).insertOne(document);
        return { content: [{ type: "text", text: JSON.stringify({ insertedId: result.insertedId }) }] };
    }
);

server.tool(
    "update_document",
    "Update a single document in a collection",
    z.object({
        databaseName: z.string().describe("Name of the database"),
        collectionName: z.string().describe("Name of the collection"),
        filter: z.record(z.any()).describe("Filter to select the document to update"),
        update: z.record(z.any()).describe("Update operations to apply"),
    }).shape,
    async ({ databaseName, collectionName, filter, update }) => {
        const result = await client.db(databaseName).collection(collectionName).updateOne(filter, update);
        return { content: [{ type: "text", text: JSON.stringify({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }) }] };
    }
);

server.tool(
    "delete_document",
    "Delete a single document from a collection",
    z.object({
        databaseName: z.string().describe("Name of the database"),
        collectionName: z.string().describe("Name of the collection"),
        filter: z.record(z.any()).describe("Filter to select the document to delete"),
    }).shape,
    async ({ databaseName, collectionName, filter }) => {
        const result = await client.db(databaseName).collection(collectionName).deleteOne(filter);
        return { content: [{ type: "text", text: JSON.stringify({ deletedCount: result.deletedCount }) }] };
    }
);

async function main() {
    await connectToMongo();
    const transport = new StdioServerTransport();
    console.error("MCP Server attempting to connect to transport...");
    await server.connect(transport);
    console.error("MCP Server connected to transport.");
};

main().catch(error => {
    console.error("Failed to start server:", error);
    client.close().catch(closeErr => console.error("Error closing MongoDB client during main error handling:", closeErr));
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.error("SIGINT received, shutting down server...");
    try {
        await client.close();
        console.error("MongoDB client closed successfully due to SIGINT.");
    } catch (err) {
        console.error("Error closing MongoDB client during SIGINT:", err);
    }
    process.exit(0);
}); 