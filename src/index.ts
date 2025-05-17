// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        db = client.db();
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
        return { structuredContent: { content: JSON.stringify(databases.databases.map((db: { name: string }) => db.name)), type: 'json' } };
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
        return { structuredContent: { content: JSON.stringify(collections.map((col: { name: string }) => col.name)), type: 'json' } };
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
        return { structuredContent: { content: JSON.stringify(documents), type: 'json' } };
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
        return { structuredContent: { content: JSON.stringify({ insertedId: result.insertedId }), type: 'json' } };
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
        return { structuredContent: { content: JSON.stringify({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }), type: 'json' } };
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
        return { structuredContent: { content: JSON.stringify({ deletedCount: result.deletedCount }), type: 'json' } };
    }
);

async function main() {
    await connectToMongo();
    console.log("MongoDB MCP Server tools registered. Listening via stdio.");
}

main().catch(error => {
    console.error("Failed to start server:", error);
    client.close();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log("Shutting down server...");
    await client.close();
    process.exit(0);
}); 