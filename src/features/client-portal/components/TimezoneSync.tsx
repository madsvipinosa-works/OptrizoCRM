"use client";

import { useEffect } from "react";
import { useDeviceTimezone } from "@/hooks/use-device-timezone";
import { saveMyTimezone } from "@/features/client-portal/timezone";

/** Saves the device timezone once it differs from what we have stored. Renders nothing. */
export function TimezoneSync({ stored }: { stored: string | null }) {
    const device = useDeviceTimezone();
    useEffect(() => {
        if (device !== stored) void saveMyTimezone(device);
    }, [device, stored]);
    return null;
}
