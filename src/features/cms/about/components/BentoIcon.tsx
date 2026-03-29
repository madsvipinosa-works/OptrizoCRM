import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";

export function BentoIcon({ name, className }: { name: string; className?: string }) {
    // Basic safety check - fallback to Zap if not found
    const IconComponent = (Icons as unknown as Record<string, LucideIcon>)[name] || Icons.Zap;
    return <IconComponent className={className} />;
}
