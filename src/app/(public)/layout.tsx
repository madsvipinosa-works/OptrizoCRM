import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MouseEffectBackground } from "@/components/ui/mouse-effect-background";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";

export default function PublicLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <SmoothScrollProvider>
            <div className="flex flex-col min-h-screen relative overflow-x-clip bg-background text-foreground selection:bg-primary/30 print:bg-transparent transition-colors duration-500">
                <Navbar />
                <main className="flex-1 relative z-10 print:m-0 print:p-0">{children}</main>
                <Footer className="relative z-10 print:hidden" />
            </div>
        </SmoothScrollProvider>
    );
}
