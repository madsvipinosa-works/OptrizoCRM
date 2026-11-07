"use client";

import { useSyncExternalStore } from "react";
import { APP_TZ } from "@/lib/datetime";

const subscribe = () => () => {};
const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || APP_TZ;

/** The device's timezone. Manila on the server and during hydration, so the first paint matches. */
export function useDeviceTimezone(): string {
  return useSyncExternalStore(subscribe, deviceTz, () => APP_TZ);
}
