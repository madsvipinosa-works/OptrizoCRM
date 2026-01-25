"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { googleSignIn } from "@/actions/auth";
import { Chrome } from "lucide-react";

export function LoginModal({ children }: { children: React.ReactNode }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-primary/20 bg-black/95 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-center text-primary text-glow">
                        Welcome Back
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Sign in to access your dashboard and projects.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <form action={googleSignIn}>
                        <Button
                            variant="outline"
                            className="w-full relative h-12 border-white/10 hover:bg-white/5 hover:text-white"
                            type="submit"
                        >
                            <Chrome className="mr-2 h-4 w-4" />
                            Sign in with Google
                        </Button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
