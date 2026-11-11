import { ExternalLink, MapPin } from "lucide-react";

/** Where the meeting happens: a Join link for video, the venue/address otherwise. Nothing when unset. */
export function MeetingLocation({ format, location }: { format: string; location: string | null | undefined }) {
    if (!location) return null;
    // The server only stores http(s) links for video; the check keeps old or odd rows from becoming links.
    if (format === "video" && /^https?:\/\//i.test(location)) {
        return (
            <a
                href={location}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
            >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Join meeting
            </a>
        );
    }
    return (
        <span className="inline-flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="break-words">{location}</span>
        </span>
    );
}
