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
                "flex flex-col rounded-lg border-t",
                "bg-gradient-to-b from-muted/50 to-muted/10",
                "p-4 text-start sm:p-6",
                "hover:from-muted/60 hover:to-muted/20",
                "max-w-[320px] sm:max-w-[320px]",
                "transition-colors duration-300",
                className
            )}
        >
            {/* Star Rating */}
            <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                        key={i}
                        className={cn(
                            "h-4 w-4",
                            i < rating
                                ? "fill-primary text-primary"
                                : "fill-muted text-muted-foreground/30"
                        )}
                    />
                ))}
            </div>

            <p className="sm:text-md mb-4 text-sm text-foreground/90 leading-relaxed">
                &ldquo;{text}&rdquo;
            </p>

            <div className="mt-auto flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={author.avatar} alt={author.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {author.name.charAt(0)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0">
                    <h3 className="text-sm font-semibold leading-none truncate">
                        {author.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                        {author.handle}
                    </p>
                </div>
            </div>
        </Card>
    )
}
