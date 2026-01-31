import { Client } from "pg";

async function testConnection(port: number) {
    console.log(`Testing connection on port ${port}...`);
    const client = new Client({
        user: "postgres",
        password: "admin123",
        host: "localhost",
        port: port,
        database: "postgres",
    });

    try {
        await client.connect();
        console.log(`✅ SUCCESS: Connected to port ${port}!`);
        await client.end();
        return true;
    } catch (err) {
        if (err instanceof Error) {
            console.log(`❌ FAILED on port ${port}: ${err.message}`);
        } else {
            console.log(`❌ FAILED on port ${port}: Unknown error`);
        }
        return false;
    }
}

async function main() {
    console.log("--- POSTGRES DIAGNOSTIC ---");
    const p5432 = await testConnection(5432);
    if (p5432) process.exit(0);

    const p5433 = await testConnection(5433);
    if (p5433) process.exit(0);

    console.log("--- RESULTS ---");
    console.log("Could not connect on 5432 (default) or 5433 (alternate).");
    console.log("Please check pgAdmin -> Server -> Properties -> Connection -> Port.");
}

main();
