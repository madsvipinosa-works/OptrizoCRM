import { db } from "@/db";
import { siteSettings, users, aboutValues } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BentoIcon } from "@/features/cms/about/components/BentoIcon";
import Image from "next/image";

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
    // Parallel Fetching
    const [settings, dbValues, team] = await Promise.all([
        db.query.siteSettings.findFirst(),
        db.query.aboutValues.findMany({ orderBy: [asc(aboutValues.order)] }),
        db.query.users.findMany({ where: eq(users.showOnAboutPage, true) })
    ]);

    // Parse Stats JSON safely
    let stats: { label: string, value: string }[] = [];
    if (settings?.companyStats) {
        try { stats = JSON.parse(settings.companyStats); } catch {}
    }

    // Parse Tech Stack JSON safely
    let techItems: { name: string, imageUrl: string }[] = [];
    if (settings?.aboutTechStackItems) {
        try { techItems = JSON.parse(settings.aboutTechStackItems); } catch {}
    }

    // Dynamic Bento GridLayout logic
    const getBentoClasses = (i: number, total: number) => {
        if (total === 1) return "md:col-span-3 md:row-span-2";
        if (total === 2) return i === 0 ? "md:col-span-2 md:row-span-2" : "md:col-span-1 md:row-span-2";
        if (total === 3) return i === 0 ? "md:col-span-2 md:row-span-2" : "md:col-span-1 md:row-span-1";
        
        // Generalized patterned fallback for >= 4
        if (i === 0) return "md:col-span-2 md:row-span-2";
        if (i === 1 || i === 2) return "md:col-span-1 md:row-span-1";
        
        // For items after the first 3
        const isLastItem = i === total - 1;
        const remainder = (total - 3) % 3;

        if (isLastItem) {
            if (remainder === 1) return "md:col-span-3 md:row-span-1"; // fills whole row
            if (remainder === 2) return "md:col-span-2 md:row-span-1"; // fills remaining 2/3 of row
        }

        return "md:col-span-1 md:row-span-1";
    };

    return (
        <div className="min-h-screen pt-24 pb-32">

            {/* Section 1: Hero & Mission */}
            <section className="relative container mx-auto px-4 pt-16 lg:pt-32 pb-24 border-b border-[#262626]">
                <div className="relative max-w-4xl mx-auto text-center space-y-8 z-10">
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                        {settings?.aboutHeroTitle || "About Our Agency"}
                    </h1>
                    
                    {settings?.missionStatement && (
                        <p className="text-lg md:text-xl text-white/80 font-normal leading-relaxed max-w-3xl mx-auto">
                            &quot;{settings.missionStatement}&quot;
                        </p>
                    )}
                </div>
            </section>

            {/* Section 2: Company Stats */}
            {stats.length > 0 && (
                <section className="container mx-auto px-4 -mt-16 relative z-20">
                    {/* Using flex layout ensures it adjusts fluidly whether 2, 3, or 4 items */}
                    <div className="flex flex-wrap bg-[#121212] border border-[#262626] rounded-2xl shadow-[0_0_40px_-15px_rgba(57,255,20,0.1)] overflow-hidden">
                        {stats.map((stat, i) => (
                            <div key={i} className="flex-1 min-w-[50%] md:min-w-[25%] p-8 text-center flex flex-col justify-center gap-2 hover:bg-white/5 transition-colors border-b md:border-b-0 border-[#262626] [&:not(:last-child)]:md:border-r [&:nth-child(odd)]:border-r md:[&:nth-child(odd)]:border-r-[#262626]">
                                <span className="text-4xl md:text-5xl font-mono font-bold text-primary">{stat.value}</span>
                                <span className="text-sm tracking-wider uppercase text-[#A3A3A3] font-semibold">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Section 3: Mission & Values (Bento Box) */}
            {dbValues.length > 0 && (
                <section className="container mx-auto px-4 py-32 border-b border-[#262626]/50">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-white tracking-tight mb-4">Our Core Values</h2>
                        <p className="text-[#A3A3A3] max-w-2xl mx-auto">The principles that drive our digital craftsmanship.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px] max-w-6xl mx-auto">
                        {dbValues.map((val, i) => (
                            <div 
                                key={val.id} 
                                className={`bg-[#121212] border border-[#262626] rounded-3xl p-8 flex flex-col items-start hover:border-primary/50 transition-colors group relative overflow-hidden ${getBentoClasses(i, dbValues.length)}`}
                            >
                                {/* Subtle Hover Glow */}
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                <div className="h-14 w-14 bg-black border border-[#262626] text-primary rounded-2xl flex items-center justify-center mb-6 shadow-inner relative z-10 group-hover:scale-110 transition-transform">
                                    <BentoIcon name={val.icon || "Zap"} className="h-6 w-6 stroke-[1.5px]" />
                                </div>
                                <h3 className={`font-bold text-white mb-4 relative z-10 ${i === 0 ? "text-3xl" : "text-xl"}`}>
                                    {val.title}
                                </h3>
                                <p className={`text-[#A3A3A3] leading-relaxed relative z-10 ${i === 0 ? "text-lg" : "text-sm"}`}>
                                    {val.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Section 4: The Team Grid */}
            <section className="container mx-auto px-4 py-32 border-b border-[#262626]/50">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-white tracking-tight mb-4">Meet The Team</h2>
                    <p className="text-[#A3A3A3] max-w-2xl mx-auto">The engineers, designers, and leaders behind the magic.</p>
                </div>

                {team.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-[#262626] rounded-2xl bg-[#121212]/50 max-w-3xl mx-auto">
                        <p className="text-[#A3A3A3] italic">No team members are currently set to public.</p>
                        <p className="text-sm text-[#A3A3A3] mt-2">Heads up: To add your CEO or team members here, go to the Admin Dashboard &amp;gt; Team, and click the &quot;Hidden from Team&quot; toggle to make them Public. Make sure they have a profile photo and Job Title set!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                        {team.map(member => (
                            <div key={member.id} className="group flex flex-col items-center text-center p-6 bg-[#121212] border border-[#262626] rounded-[2rem] hover:border-primary/50 transition-colors">
                                <div className="relative mb-6">
                                    <div className="absolute -inset-1 rounded-full bg-gradient-to-b from-primary/50 to-transparent opacity-0 group-hover:opacity-100 blur-md transition-all duration-500" />
                                    <Avatar className="h-40 w-40 border-2 border-[#262626] group-hover:border-primary transition-colors relative z-10">
                                        <AvatarImage src={member.image || ""} className="object-cover" />
                                        <AvatarFallback className="bg-gradient-to-br from-[#121212] to-black text-4xl text-white">
                                            {member.name?.[0]?.toUpperCase() || "T"}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <h3 className="text-2xl font-bold text-white">{member.name}</h3>
                                <p className="text-primary font-semibold tracking-wider uppercase text-sm mt-2">{member.jobTitle || "Engineer"}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Section 5: Tech Stack Logos */}
            {techItems.length > 0 && (
                <section className="container mx-auto px-4 py-32 text-center border-b border-[#262626]/50">
                    <p className="text-sm font-semibold tracking-widest text-[#A3A3A3] uppercase mb-12">
                        {settings?.aboutTechStack || "Powered By Next-Generation Technologies"}
                    </p>
                    
                    <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
                        {techItems.map((tech, i) => (
                            <div key={i} className="flex gap-4 items-center text-white font-bold text-2xl tracking-tighter hover:text-white transition-colors group">
                                {tech.imageUrl && (
                                    <div className="relative w-12 h-12">
                                        <Image
                                            src={tech.imageUrl}
                                            alt={tech.name}
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                )}
                                <span>{tech.name}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Section 6: Dynamic Call-to-Action */}
            <section className="container mx-auto px-4 py-32 text-center">
                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-12 max-w-4xl mx-auto shadow-[0_0_50px_-15px_rgba(57,255,20,0.1)]">
                    <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
                        {settings?.aboutCtaHeadline || "Ready to start your next project?"}
                    </h2>
                    <p className="text-[#A3A3A3] text-lg md:text-xl max-w-2xl mx-auto mb-10">
                        {settings?.aboutCtaText || "Let's build something extraordinary together."}
                    </p>
                    <a 
                        href="/contact" 
                        className="inline-flex items-center justify-center h-14 px-8 text-lg font-bold text-black bg-primary rounded-xl hover:bg-white hover:text-black transition-all shadow-lg hover:shadow-primary/50"
                    >
                        Schedule a Consultation
                    </a>
                </div>
            </section>
        </div>
    );
}
