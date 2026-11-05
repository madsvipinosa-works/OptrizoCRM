import "server-only";

import { revalidatePath } from "next/cache";

/** Public pages that read the content tables. Called after a content change has committed. */
export function revalidateContentPaths(): void {
    for (const path of ["/", "/about", "/contact", "/services", "/projects", "/sitemap.xml"]) {
        revalidatePath(path);
    }
}

