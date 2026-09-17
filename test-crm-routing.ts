import "dotenv/config";
import { db } from "./src/db";
import { users, leads, leadAssignees, crmTasks } from "./src/db/schema";
import { eq, sql, inArray, not } from "drizzle-orm";
import crypto from "crypto";

async function runTest() {
    console.log("Starting CRM Routing & Task Provisioning Test...");

    try {
        // 1. Setup: Ensure we have at least two sales reps
        const salesReps = await db.query.users.findMany({
            where: eq(users.role, "sales")
        });

        if (salesReps.length < 2) {
            console.log("Creating mock sales reps for testing...");
            for (let i = salesReps.length; i < 2; i++) {
                const [newRep] = await db.insert(users).values({
                    email: `salesrep${i}@example.com`,
                    name: `Sales Rep ${i}`,
                    password: "password123",
                    role: "sales"
                }).returning();
                salesReps.push(newRep);
            }
        }

        console.log(`Found/Created ${salesReps.length} sales reps.`);

        // 2. Mock a new lead insertion (Simulating createLead transaction)
        console.log("Simulating new lead creation...");
        const randomStr = crypto.randomBytes(4).toString("hex");
        const clientEmail = `testclient_${randomStr}@example.com`;
        
        const [client] = await db.insert(users).values({
            email: clientEmail,
            name: `Test Client ${randomStr}`,
            password: "password123",
            role: "client"
        }).returning();

        const [newLead] = await db.insert(leads).values({
            clientId: client.id,
            businessName: `Test Business ${randomStr}`,
            contactEmail: clientEmail,
            leadScore: 75,
            priority: "Hot",
            status: "New Lead",
            source: "Test Script",
            lastContactedAt: new Date(),
        }).returning();

        console.log(`Lead Created: ID ${newLead.id}`);

        // 3. Test Round-Robin Logic
        console.log("Running Round-Robin Assignment Logic...");
        const repsWithCounts = await Promise.all(salesReps.map(async (rep) => {
            const activeCount = await db.select({ count: sql<number>`count(*)` })
                .from(leadAssignees)
                .innerJoin(leads, eq(leadAssignees.leadId, leads.id))
                .where(
                    sql`${leadAssignees.userId} = ${rep.id} AND ${leads.status} NOT IN ('Closed Won', 'Closed Lost')`
                );
            return { repId: rep.id, count: Number(activeCount[0].count), name: rep.name };
        }));

        console.log("Current Load Distribution:");
        repsWithCounts.forEach(r => console.log(` - ${r.name}: ${r.count} active leads`));

        repsWithCounts.sort((a, b) => a.count - b.count);
        const assignedRepId = repsWithCounts[0].repId;
        const assignedRepName = repsWithCounts[0].name;

        console.log(`=> Assigning lead to ${assignedRepName} (lowest count)`);

        await db.insert(leadAssignees).values({
            leadId: newLead.id,
            userId: assignedRepId,
        });

        // 4. Test Task Provisioning Logic
        console.log("Provisioning Sales Playbook Tasks...");
        const now = new Date();
        const discoveryDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
        const proposalDueDate = new Date(now.getTime() + 72 * 60 * 60 * 1000); // +72h

        await db.insert(crmTasks).values([
            {
                leadId: newLead.id,
                assignedTo: assignedRepId,
                title: "Initial Discovery Call",
                description: "Automatically provisioned task.",
                taskType: "Call",
                priority: "High",
                status: "Pending",
                dueDate: discoveryDueDate,
            },
            {
                leadId: newLead.id,
                assignedTo: assignedRepId,
                title: "Send Tailored Scope & Proposal",
                description: "Automatically provisioned task.",
                taskType: "Email",
                priority: "Medium",
                status: "Pending",
                dueDate: proposalDueDate,
            }
        ]);

        // 5. Verification Query
        console.log("Verifying Database State...");
        const verifyLead = await db.query.leads.findFirst({
            where: eq(leads.id, newLead.id),
            with: {
                assignees: { with: { user: true } },
                crmTasks: true,
            }
        });

        if (!verifyLead) {
            throw new Error("Lead not found during verification.");
        }

        const assignedUser = verifyLead.assignees[0]?.user?.name;
        console.log(`Verified Assignee: ${assignedUser} (Expected: ${assignedRepName})`);
        
        console.log(`Verified Tasks (${verifyLead.crmTasks.length} total):`);
        verifyLead.crmTasks.forEach(t => {
            console.log(` - [${t.taskType}] ${t.title} (Due: ${t.dueDate?.toISOString()})`);
        });

        if (assignedUser === assignedRepName && verifyLead.crmTasks.length === 2) {
            console.log("✅ SUCCESS: CRM Routing and Task Provisioning verified.");
        } else {
            console.log("❌ FAILURE: Verification mismatch.");
        }

    } catch (error) {
        console.error("Test failed with error:", error);
    } finally {
        process.exit(0);
    }
}

runTest();
