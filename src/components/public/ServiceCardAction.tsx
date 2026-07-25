"use client";

import { Button } from "@/components/ui/button";
import { LoginModal } from "@/components/auth/LoginModal";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface ServiceCardActionProps {
    serviceId: string;
    isLoggedIn: boolean;
}

export function ServiceCardAction({ serviceId, isLoggedIn }: ServiceCardActionProps) {
    const redirectTarget = `/portal/request-proposal?serviceId=${serviceId}`;

    if (isLoggedIn) {
        return (
            <Button asChild className="w-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-black font-semibold transition-all">
                <Link href={redirectTarget}>
                    Avail Service / Request Proposal <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        );
    }

    return (
        <LoginModal defaultRedirect={redirectTarget}>
            <Button className="w-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-black font-semibold transition-all">
                Avail Service / Request Proposal <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </LoginModal>
    );
}
