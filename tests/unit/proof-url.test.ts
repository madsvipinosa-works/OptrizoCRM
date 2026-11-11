import { describe, expect, it } from "vitest";
import { normalizeProofUrl } from "@/lib/proof-url";

describe("normalizeProofUrl", () => {
    it("keeps web links and adds https when missing", () => {
        expect(normalizeProofUrl("https://figma.com/file/1")).toBe("https://figma.com/file/1");
        expect(normalizeProofUrl("staging.optrizo.com")).toBe("https://staging.optrizo.com/");
    });

    it("keeps private-file links from the uploader", () => {
        const url = "/api/private-file?blobUrl=%2Fuploads%2Fa.png&projectId=p1";
        expect(normalizeProofUrl(url)).toBe(url);
    });

    it("rejects things that cannot be opened", () => {
        expect(normalizeProofUrl("dada")).toBeNull();
        expect(normalizeProofUrl("javascript:alert(1)")).toBeNull();
        expect(normalizeProofUrl("/dashboard/pm")).toBeNull();
        expect(normalizeProofUrl("  ")).toBeNull();
    });
});
