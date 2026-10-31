import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { insert, values } = vi.hoisted(() => {
  const values = vi.fn().mockResolvedValue(undefined);
  return { values, insert: vi.fn(() => ({ values })) };
});

vi.mock("@/db", () => ({ db: { insert } }));

import { POST } from "@/app/api/webhooks/leads/route";

const payload = { name: "Maria Santos", email: "maria@example.com", service: "Web Development" };

function request(authorization?: string) {
  return new Request("http://localhost/api/webhooks/leads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(payload),
  });
}

describe("leads webhook authentication", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    insert.mockClear();
    values.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fails closed with 500 when WEBHOOK_SECRET is not set", async () => {
    vi.stubEnv("WEBHOOK_SECRET", "");
    const res = await POST(request("Bearer optrizo-dev-secret-token"));
    expect(res.status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
  });

  it("no longer accepts the old hard-coded fallback token when a secret is set", async () => {
    vi.stubEnv("WEBHOOK_SECRET", "a-real-secret");
    const res = await POST(request("Bearer optrizo-dev-secret-token"));
    expect(res.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a missing Authorization header", async () => {
    vi.stubEnv("WEBHOOK_SECRET", "a-real-secret");
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a wrong token of a different length without throwing", async () => {
    vi.stubEnv("WEBHOOK_SECRET", "a-real-secret");
    const res = await POST(request("Bearer x"));
    expect(res.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("accepts the correct secret and creates the inquiry", async () => {
    vi.stubEnv("WEBHOOK_SECRET", "a-real-secret");
    const res = await POST(request("Bearer a-real-secret"));
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
