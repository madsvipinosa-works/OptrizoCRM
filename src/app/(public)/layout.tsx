import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MouseEffectBackground } from "@/components/ui/mouse-effect-background";

export default function PublicLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex flex-col min-h-screen relative overflow-hidden bg-black text-white selection:bg-primary/30 print:bg-transparent">
            {/* Global Interactive Mouse Effect Background */}
            <div className="print:hidden">
                <MouseEffectBackground className="fixed inset-0 z-0 opacity-40 pointer-events-auto" dotSize={1.5} dotSpacing={32} repulsionRadius={80} />
            </div>

            <div className="print:hidden">
                 <Navbar />
            </div>
            <main className="flex-1 relative z-10 print:m-0 print:p-0">{children}</main>
            <div className="print:hidden">
                <Footer className="relative z-10" />
            </div>
        </div>
    );
}
