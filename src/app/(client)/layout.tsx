import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MouseEffectBackground } from "@/components/ui/mouse-effect-background";
import { ClientSidebar } from "@/features/client-portal/components/ClientSidebar";

export default function ClientLayout({
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

            <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 pt-24 md:pt-28 pb-12 flex flex-col md:flex-row gap-8 print:m-0 print:p-0">
                <div className="print:hidden">
                    <ClientSidebar />
                </div>
                <div className="flex-1 min-w-0">
                    {children}
                </div>
            </main>

            <div className="print:hidden">
                <Footer className="relative z-10" />
            </div>
        </div>
    );
}
