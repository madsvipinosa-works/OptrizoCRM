"use client";

import { PlaceCard } from "@/components/ui/card-22";
import { LoginModal } from "@/components/auth/LoginModal";
import { useRouter } from "next/navigation";

interface ServiceCardItemProps {
  service: {
    id: string;
    title: string;
    description: string;
    icon?: string | null;
  };
  images: string[];
  tags: string[];
  isLoggedIn: boolean;
}

export function ServiceCardItem({ service, images, tags, isLoggedIn }: ServiceCardItemProps) {
  const router = useRouter();
  const redirectTarget = `/portal/request-proposal?serviceId=${service.id}`;

  const handleAction = () => {
    if (isLoggedIn) {
      router.push(redirectTarget);
    }
  };

  const cardContent = (
    <PlaceCard
      images={images}
      tags={tags}
      title={service.title}
      description={service.description}
      buttonText="Avail This"
      isTopRated={false}
      onAction={handleAction}
      className="h-full max-w-full"
    />
  );

  if (isLoggedIn) {
    return cardContent;
  }

  return (
    <LoginModal defaultRedirect={redirectTarget}>
      <div className="h-full cursor-pointer">
        {cardContent}
      </div>
    </LoginModal>
  );
}
