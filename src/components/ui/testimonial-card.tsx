import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star } from "lucide-react"

export interface TestimonialAuthor {
    name: string
    handle: string
    avatar?: string
}

export interface TestimonialCardProps {
    author: TestimonialAuthor
    text: string
    href?: string
    rating?: number
    className?: string
}

export function TestimonialCard({
    author,
    text,
    href,
    rating = 5,
    className,
}: TestimonialCardProps) {
    const Card = href ? 'a' : 'div'

    return (
        <Card
            {...(href ? { href } : {})}
            className={cn(
                "flex flex-col justify-between rounded-3xl border border-border/80 shrink-0 w-[320px] sm:w-[360px] max-w-none overflow-hidden min-h-[270px] sm:min-h-[290px]",
                "bg-card shadow-sm hover:shadow-xl hover:border-primary/50",
                "p-6 sm:p-7 text-start",
                "transition-all duration-300 group",
                className
            )}
        >
            <div className="overflow-hidden">
                {/* Star Rating & Verified Monospace Pill */}
                <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                                key={i}
                                className={cn(
                                    "h-3.5 w-3.5",
                                    i < rating
                                        ? "fill-primary text-primary"
                                        : "fill-muted text-muted-foreground/30"
                                )}
                            />
                        ))}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/5">
                        VERIFIED
                    </span>
                </div>

                <p className="text-sm sm:text-[15px] text-foreground/90 leading-relaxed italic mb-6">
                    &ldquo;{text}&rdquo;
                </p>
            </div>

            <div className="mt-auto pt-4 border-t border-border/60 flex items-center gap-3.5 w-full min-w-0 overflow-hidden">
                <Avatar className="h-10 w-10 shrink-0 border border-border/80 ring-2 ring-primary/20">
                    <AvatarImage src={author.avatar} alt={author.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-mono text-xs font-bold">
                        {author.name.charAt(0)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                    <h4 className="text-sm font-black uppercase tracking-tight text-foreground truncate w-full block">
                        {author.name}
                    </h4>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5 line-clamp-2 break-words leading-snug w-full block">
                        {author.handle}
                    </p>
                </div>
            </div>
        </Card>
    )
}
