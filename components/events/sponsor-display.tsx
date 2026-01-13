import { ImageIcon } from "lucide-react";
import type { Sponsor, EventSponsor } from "@/lib/types";

interface SponsorDisplayProps {
  sponsors: (EventSponsor & { sponsors: Sponsor })[];
}

export function SponsorDisplay({ sponsors }: SponsorDisplayProps) {
  if (!sponsors || sponsors.length === 0) {
    return null;
  }

  // Sort by sort_order
  const sortedSponsors = [...sponsors].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Supported by</p>
      <div className="flex flex-wrap gap-4">
        {sortedSponsors.map((es) => {
          const sponsor = es.sponsors;
          if (!sponsor) return null;

          const content = (
            <div className="flex flex-col items-center gap-2 group">
              {/* Logo */}
              <div className="w-16 h-16 rounded-lg bg-white border flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                {sponsor.logo_url ? (
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.name}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              {/* Name */}
              <span className="text-xs text-muted-foreground text-center max-w-[80px] truncate">
                {sponsor.name}
              </span>
            </div>
          );

          // If sponsor has a website, wrap in link
          if (sponsor.website_url) {
            return (
              <a
                key={es.sponsor_id}
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {content}
              </a>
            );
          }

          return <div key={es.sponsor_id}>{content}</div>;
        })}
      </div>
    </div>
  );
}
