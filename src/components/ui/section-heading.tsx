import { cn } from "@/lib/utils";

interface SectionHeadingProps {
    text: string;
    className?: string;
}

/** A real h2 for public page sections. The section around it already fades up on scroll (ScrollReveal). */
export function SectionHeading({ text, className }: SectionHeadingProps) {
    return <h2 className={cn("text-center font-semibold tracking-tight text-foreground [text-wrap:balance]", className)}>{text}</h2>;
}
