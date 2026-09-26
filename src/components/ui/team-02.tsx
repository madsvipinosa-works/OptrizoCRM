"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Twitter, Linkedin, Instagram, Globe } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const InstagramIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clipPath="url(#clip-instagram-team02)">
      <path
        d="M12 2.162c3.204 0 3.584.012 4.849.07 1.17.054 1.805.249 2.228.413.56.218.96.478 1.38.898s.68.82.898 1.38c.164.423.36 1.058.413 2.228.058 1.265.07 1.645.07 4.849s-.012 3.584-.07 4.849c-.053 1.17-.249 1.805-.413 2.228a3.7 3.7 0 0 1-.898 1.38c-.42.42-.82.68-1.38.898-.423.164-1.058.36-2.228.413-1.265.058-1.645.07-4.849.07s-3.584-.012-4.849-.07c-1.17-.053-1.805-.249-2.228-.413a3.7 3.7 0 0 1-1.38-.898c-.42-.42-.68-.82-.898-1.38-.164-.423-.36-1.058-.413-2.228-.058-1.265-.07-1.645-.07-4.849s.012-3.584.07-4.849c.054-1.17.249-1.805.413-2.228.218-.56.478-.96.898-1.38s.82-.68 1.38-.898c.423-.164 1.058-.36 2.228-.413 1.265-.058 1.645-.07 4.849-.07M12 0C8.741 0 8.332.014 7.052.072 5.775.131 4.902.333 4.14.63a5.9 5.9 0 0 0-2.126 1.384A5.9 5.9 0 0 0 .63 4.14c-.297.763-.5 1.635-.558 2.912C.014 8.332 0 8.741 0 12s.014 3.668.072 4.948c.059 1.277.261 2.15.558 2.912.307.79.717 1.459 1.384 2.126A5.9 5.9 0 0 0 4.14 23.37c.763.297 1.635.5 2.912.558C8.332 23.986 8.741 24 12 24s3.668-.014 4.948-.072c1.277-.059 2.15-.261 2.912-.558a5.9 5.9 0 0 0 2.126-1.384 5.9 5.9 0 0 0 1.384-2.126c.297-.763.5-1.635.558-2.912.058-1.28.072-1.689.072-4.948s-.014-3.668-.072-4.948c-.059-1.277-.261-2.15-.558-2.912a5.9 5.9 0 0 0-1.384-2.126A5.9 5.9 0 0 0 19.86.63c-.763-.297-1.635-.5-2.912-.558C15.668.014 15.259 0 12 0m0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8m7.846-10.406a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="clip-instagram-team02">
        <rect width="24" height="24" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const LinkedinIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clipPath="url(#clip-linkedin-team02)">
      <path
        d="M13.633 13.633h-2.37V9.92c0-.885-.017-2.025-1.234-2.025-1.235 0-1.424.965-1.424 1.96v3.778h-2.37V5.998H8.51v1.043h.031a2.5 2.5 0 0 1 2.246-1.233c2.403 0 2.846 1.58 2.846 3.637zM3.56 4.954a1.376 1.376 0 1 1 0-2.751 1.376 1.376 0 0 1 0 2.751m1.185 8.679H2.372V5.998h2.373zM14.815.001H1.18A1.17 1.17 0 0 0 0 1.154v13.691A1.17 1.17 0 0 0 1.18 16h13.635A1.17 1.17 0 0 0 16 14.845V1.153A1.17 1.17 0 0 0 14.815 0"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="clip-linkedin-team02">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const DribbbleIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clipPath="url(#clip-dribbble-team02)">
      <path
        d="M15.942 4.242C12.683 7.617 8.333 8.7 1.874 9.117m16.25 1.583c-5.517-1.175-10.117.833-13.65 5.267M7.133 2.292c3.642 5 5 7.85 6.667 14.766M18.333 10a8.333 8.333 0 1 1-16.666 0 8.333 8.333 0 0 1 16.666 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="clip-dribbble-team02">
        <rect width="20" height="20" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export type TeamSocial = {
  platform?: "instagram" | "linkedin" | "dribbble" | "twitter" | "website";
  icon?: React.ReactNode;
  link: string;
};

const renderSocialIcon = (social: TeamSocial) => {
  if (social.icon) return social.icon;
  if (social.platform === "linkedin") return <LinkedinIcon size={16} />;
  if (social.platform === "instagram") return <InstagramIcon size={16} />;
  if (social.platform === "dribbble") return <DribbbleIcon size={16} />;
  if (social.platform === "twitter") return <Twitter className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
};

export type TeamMemberItem = {
  id?: string;
  name: string;
  role: string;
  image: string;
  socials?: TeamSocial[];
};

export const defaultTeamData: TeamMemberItem[] = [
  {
    name: "Martha Finley",
    role: "Creative Director",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600",
    socials: [
      {
        icon: <InstagramIcon size={16} />,
        link: "#",
      },
      {
        icon: <DribbbleIcon size={16} />,
        link: "#",
      },
      {
        icon: <LinkedinIcon size={16} />,
        link: "#",
      },
    ],
  },
  {
    name: "Floyd Miles",
    role: "Marketing Strategist",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600",
    socials: [
      {
        icon: <InstagramIcon size={16} />,
        link: "#",
      },
      {
        icon: <DribbbleIcon size={16} />,
        link: "#",
      },
      {
        icon: <LinkedinIcon size={16} />,
        link: "#",
      },
    ],
  },
  {
    name: "Glenna Snyder",
    role: "Lead Designer",
    image:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=600",
    socials: [
      {
        icon: <InstagramIcon size={16} />,
        link: "#",
      },
      {
        icon: <DribbbleIcon size={16} />,
        link: "#",
      },
      {
        icon: <LinkedinIcon size={16} />,
        link: "#",
      },
    ],
  },
  {
    name: "Albert Flores",
    role: "UX/UI Developer",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600",
    socials: [
      {
        icon: <InstagramIcon size={16} />,
        link: "#",
      },
      {
        icon: <DribbbleIcon size={16} />,
        link: "#",
      },
      {
        icon: <LinkedinIcon size={16} />,
        link: "#",
      },
    ],
  },
];

export interface TeamProps {
  badge?: string;
  title?: string;
  subtitle?: string;
  members?: TeamMemberItem[];
  className?: string;
}

const Team = ({
  badge = "Team",
  title = "Meet our team",
  subtitle = "Our team is committed to redefining digital experiences through innovative web solutions while fostering a diverse and collaborative environment.",
  members,
  className,
}: TeamProps = {}) => {
  const displayTeam = members && members.length > 0 ? members : defaultTeamData;

  return (
    <section className={cn("relative w-full", className)}>
      <div className="lg:py-20 sm:py-16 py-8">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 xl:px-16">
          <div className="flex flex-col items-center justify-center gap-16">
            <div className="max-w-xl mx-auto flex flex-col items-center justify-center text-center gap-4">
              <Badge variant={"outline"} className="px-3.5 py-1.5 h-auto text-xs uppercase tracking-widest border-primary/30 bg-primary/10 text-primary font-semibold">
                {badge}
              </Badge>
              <div className="flex flex-col items-center justify-center gap-3">
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
                  {title}
                </h2>
                <p className="text-base font-normal text-muted-foreground leading-relaxed">
                  {subtitle}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
              {displayTeam.map((value, index) => {
                const socials = value.socials && value.socials.length > 0 ? value.socials : [
                  { icon: <InstagramIcon size={16} />, link: "#" },
                  { icon: <DribbbleIcon size={16} />, link: "#" },
                  { icon: <LinkedinIcon size={16} />, link: "#" },
                ];

                return (
                  <div
                    key={value.id || index}
                    className="group flex flex-col items-start gap-4 p-3 rounded-2xl border border-border/60 bg-card/60 dark:bg-card/40 hover:border-primary/50 transition-all duration-300 backdrop-blur-md shadow-xs hover:shadow-[0_0_25px_rgba(0,214,57,0.12)]"
                  >
                    <div className="relative w-full h-80 rounded-xl overflow-hidden bg-muted/40 border border-border/40">
                      <img
                        src={value.image}
                        alt={value.name}
                        height={325}
                        width={270}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-background/60 dark:bg-gray-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-4 backdrop-blur-[2px]">
                        <div className="flex gap-2">
                          {socials.map((social, idx) => (
                            <a
                              key={idx}
                              href={social.link}
                              target="_blank"
                              rel="noreferrer"
                              className="flex w-fit bg-card border border-border p-2.5 rounded-full text-foreground hover:text-primary hover:border-primary/50 transition-all duration-300 shadow-sm"
                            >
                              {renderSocialIcon(social)}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 px-1 pb-1">
                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {value.name}
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {value.role}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Team;
export { Team };
