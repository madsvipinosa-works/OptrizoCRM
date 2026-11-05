import { describe, it, expect } from "vitest";
import {
    aboutFieldsSchema,
    checkContentImage,
    contactFieldsSchema,
    CONTENT_IMAGE_MAX_BYTES,
    detectContentImageType,
    homeFieldsSchema,
    portfolioInputSchema,
    serviceInputSchema,
} from "@/features/cms/content/schemas";

describe("Content schemas validation and boundary tests", () => {
    describe("Service schema", () => {
        const base = {
            title: "Web Development",
            description: "Custom digital platforms",
            inclusions: ["Frontend Architecture", "API Integration"],
            showOnServicesPage: true,
            showInInquiry: true,
        };

        it("accepts title of 40 characters and rejects 41 characters", () => {
            const schema = serviceInputSchema();
            expect(schema.safeParse({ ...base, title: "a".repeat(40) }).success).toBe(true);
            const res = schema.safeParse({ ...base, title: "a".repeat(41) });
            expect(res.success).toBe(false);
            if (!res.success) {
                expect(res.error.issues[0].message).toContain("40");
            }
        });

        it("accepts description of 60 characters and rejects 61 characters", () => {
            const schema = serviceInputSchema();
            expect(schema.safeParse({ ...base, description: "b".repeat(60) }).success).toBe(true);
            const res = schema.safeParse({ ...base, description: "b".repeat(61) });
            expect(res.success).toBe(false);
            if (!res.success) {
                expect(res.error.issues[0].message).toContain("60");
            }
        });

        it("rejects HTML markup in service fields", () => {
            const schema = serviceInputSchema();
            expect(schema.safeParse({ ...base, title: "<b>Bold</b>" }).success).toBe(false);
            expect(schema.safeParse({ ...base, description: "<script>bad</script>" }).success).toBe(false);
        });

        it("splits multiline inclusions and rejects > 12 inclusions", () => {
            const schema = serviceInputSchema();
            const lines = Array.from({ length: 13 }, (_, i) => `Feature ${i + 1}`).join("\n");
            expect(schema.safeParse({ ...base, inclusions: lines }).success).toBe(false);

            const validLines = Array.from({ length: 12 }, (_, i) => `Feature ${i + 1}`).join("\n");
            expect(schema.safeParse({ ...base, inclusions: validLines }).success).toBe(true);
        });
    });

    describe("Portfolio schema", () => {
        const base = {
            title: "Enterprise ERP Portal",
            summary: "A robust enterprise portal",
            technologies: ["Next.js", "PostgreSQL"],
            galleryImages: [],
            clientConsent: false,
            clientDisplayName: "Fintech Leader",
        };

        it("accepts summary of 200 characters and rejects 201 characters", () => {
            const schema = portfolioInputSchema();
            expect(schema.safeParse({ ...base, summary: "s".repeat(200) }).success).toBe(true);
            expect(schema.safeParse({ ...base, summary: "s".repeat(201) }).success).toBe(false);
        });

        it("accepts up to 5 gallery images and rejects > 5", () => {
            const existingUrls = Array.from({ length: 6 }, (_, i) => `/uploads/content/img${i}.jpg`);
            const schema = portfolioInputSchema({ existingUrls });

            expect(schema.safeParse({ ...base, galleryImages: existingUrls.slice(0, 5) }).success).toBe(true);
            expect(schema.safeParse({ ...base, galleryImages: existingUrls }).success).toBe(false);
        });

        it("rejects javascript: URLs in liveUrl and accepts https", () => {
            const schema = portfolioInputSchema();
            expect(schema.safeParse({ ...base, liveUrl: "javascript:alert(1)" }).success).toBe(false);
            expect(schema.safeParse({ ...base, liveUrl: "https://example.com" }).success).toBe(true);
        });

        it("requires clientName when clientConsent is true", () => {
            const schema = portfolioInputSchema();
            const invalid = schema.safeParse({ ...base, clientConsent: true, clientName: "" });
            expect(invalid.success).toBe(false);

            const valid = schema.safeParse({ ...base, clientConsent: true, clientName: "Acme Corp" });
            expect(valid.success).toBe(true);
        });
    });

    describe("Pages schemas", () => {
        describe("Home", () => {
            const baseHome = {
                heading: "Bespoke Digital Systems",
                intro: "Scalable modern architectures for global enterprises.",
                mainImageUrl: "",
                featuredServiceIds: ["svc-1", "svc-2"],
                featuredPortfolioIds: ["port-1"],
            };

            it("enforces limits on heading (60) and intro (160)", () => {
                const schema = homeFieldsSchema();
                expect(schema.safeParse({ ...baseHome, heading: "h".repeat(60) }).success).toBe(true);
                expect(schema.safeParse({ ...baseHome, heading: "h".repeat(61) }).success).toBe(false);

                expect(schema.safeParse({ ...baseHome, intro: "i".repeat(160) }).success).toBe(true);
                expect(schema.safeParse({ ...baseHome, intro: "i".repeat(161) }).success).toBe(false);
            });

            it("rejects more than 3 featured service or portfolio IDs", () => {
                const schema = homeFieldsSchema();
                expect(schema.safeParse({ ...baseHome, featuredServiceIds: ["1", "2", "3", "4"] }).success).toBe(false);
                expect(schema.safeParse({ ...baseHome, featuredPortfolioIds: ["1", "2", "3", "4"] }).success).toBe(false);
                expect(schema.safeParse({ ...baseHome, featuredServiceIds: ["1", "2", "3"] }).success).toBe(true);
            });
        });

        describe("About", () => {
            const baseAbout = {
                heading: "About Our Studio",
                story: "We are an engineering studio building software.",
                mission: "Deliver high performance.",
                vision: "Global excellence.",
                howWeWork: "Agile sprints.",
                team: [
                    { name: "Alice Smith", jobTitle: "Lead Engineer", photoUrl: "" },
                ],
            };

            it("enforces limits on story (600), mission (300), vision (300), howWeWork (160)", () => {
                const schema = aboutFieldsSchema();
                expect(schema.safeParse({ ...baseAbout, story: "a".repeat(600) }).success).toBe(true);
                expect(schema.safeParse({ ...baseAbout, story: "a".repeat(601) }).success).toBe(false);

                expect(schema.safeParse({ ...baseAbout, mission: "m".repeat(300) }).success).toBe(true);
                expect(schema.safeParse({ ...baseAbout, mission: "m".repeat(301) }).success).toBe(false);

                expect(schema.safeParse({ ...baseAbout, vision: "v".repeat(300) }).success).toBe(true);
                expect(schema.safeParse({ ...baseAbout, vision: "v".repeat(301) }).success).toBe(false);

                expect(schema.safeParse({ ...baseAbout, howWeWork: "w".repeat(160) }).success).toBe(true);
                expect(schema.safeParse({ ...baseAbout, howWeWork: "w".repeat(161) }).success).toBe(false);
            });

            it("rejects team of > 12 members and member name/title > 60 chars", () => {
                const schema = aboutFieldsSchema();
                const bigTeam = Array.from({ length: 13 }, (_, i) => ({
                    name: `Member ${i}`,
                    jobTitle: "Dev",
                    photoUrl: "",
                }));
                expect(schema.safeParse({ ...baseAbout, team: bigTeam }).success).toBe(false);

                expect(
                    schema.safeParse({
                        ...baseAbout,
                        team: [{ name: "x".repeat(61), jobTitle: "Dev", photoUrl: "" }],
                    }).success,
                ).toBe(false);
            });

            it("accepts unchanged external https avatar URLs in team", () => {
                const googleAvatar = "https://lh3.googleusercontent.com/a/avatar123";
                const schema = aboutFieldsSchema({ existingUrls: [googleAvatar] });
                expect(
                    schema.safeParse({
                        ...baseAbout,
                        team: [{ name: "Jane Doe", jobTitle: "PM", photoUrl: googleAvatar }],
                    }).success,
                ).toBe(true);
            });
        });

        describe("Contact", () => {
            const baseContact = {
                heading: "Contact Us",
                intro: "Get in touch with engineering.",
                email: "hello@optrizo.com",
                phone: "+1 (555) 123-4567",
                address: "123 Innovation Drive, Tech Valley, CA 94043",
                officeHours: "Mon - Fri from 9am to 6pm PST",
            };

            it("validates contact fields and limits", () => {
                const schema = contactFieldsSchema();
                expect(schema.safeParse(baseContact).success).toBe(true);

                expect(schema.safeParse({ ...baseContact, email: "not-an-email" }).success).toBe(false);
                expect(schema.safeParse({ ...baseContact, phone: "12" }).success).toBe(false);
                expect(schema.safeParse({ ...baseContact, address: "x".repeat(161) }).success).toBe(false);
                expect(schema.safeParse({ ...baseContact, officeHours: "x".repeat(121) }).success).toBe(false);
            });
        });
    });

    describe("Image upload checks", () => {
        it("detects JPEG (FF D8 FF) and PNG (89 50 4E 47)", () => {
            expect(detectContentImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
            expect(detectContentImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
        });

        it("rejects SVG, WebP, GIF, text", () => {
            // WebP (RIFF)
            expect(detectContentImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeNull();
            // GIF
            expect(detectContentImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
            // SVG / Text
            expect(detectContentImageType(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
        });

        it("rejects files exceeding 2MB", () => {
            const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
            const res = checkContentImage({ size: CONTENT_IMAGE_MAX_BYTES + 1, bytes });
            expect(res).toEqual({ ok: false, error: "FILE_TOO_LARGE" });
        });

        it("accepts valid JPEG under 2MB", () => {
            const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
            const res = checkContentImage({ size: 1024, bytes });
            expect(res).toEqual({ ok: true, type: "jpg" });
        });
    });
});
