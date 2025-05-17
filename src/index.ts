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

async function connectToMongo() {
    console.error("Connecting to MongoDB...");
    try {
        await client.connect();
        console.error("MongoDB client connected.");
        db = client.db();
        console.error("MongoDB database connected.");
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        process.exit(1);
    }
}

const server = new McpServer({
    name: "mongo-mcp",
    version: "1.0.0",
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
    await server.connect(transport);
};

main().catch(error => {
    console.error("Failed to start server:", error);
    client.close();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.error("SIGINT received, shutting down server...");
    await client.close();
    process.exit(0);
}); 