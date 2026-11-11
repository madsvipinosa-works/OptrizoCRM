"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MeetingItem } from "@/features/meetings/actions";
import { meetingLocationLabel } from "@/features/meetings/rules";

/** Video/meeting link or venue/address, by format. Renders nothing for phone meetings. */
export function MeetingLocationField({
    format,
    value,
    onChange,
}: {
    format: MeetingItem["format"];
    value: string;
    onChange: (value: string) => void;
}) {
    const label = meetingLocationLabel(format);
    if (!label) return null;
    const isLink = format === "video";
    return (
        <div className="space-y-1">
            <Label htmlFor="meeting-location" className="text-sm">{label}</Label>
            <Input
                id="meeting-location"
                type={isLink ? "url" : "text"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={isLink ? "https://meet.google.com/abc-defg-hij" : "Building, street, city"}
                maxLength={500}
                required
                className="h-9 text-sm"
            />
        </div>
    );
}
