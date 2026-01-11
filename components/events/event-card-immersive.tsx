"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, Users, Expand } from "lucide-react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { EventDefaultImage } from "@/components/events/event-default-image";
import { ImmersiveImage } from "@/components/events/immersive-image";
import { formatInDaLat } from "@/lib/timezone";
import { isVideoUrl } from "@/lib/media-utils";
import type { Event, EventCounts } from "@/lib/types";

interface EventCardImmersiveProps {
  event: Event;
  counts?: EventCounts;
}

export function EventCardImmersive({ event, counts }: EventCardImmersiveProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const spotsText = event.capacity
    ? `${counts?.going_spots ?? 0}/${event.capacity}`
    : `${counts?.going_spots ?? 0}`;

  const isFull = event.capacity
    ? (counts?.going_spots ?? 0) >= event.capacity
    : false;

  const hasImage = !!event.image_url;
  const imageIsVideo = isVideoUrl(event.image_url);

  return (
    <>
      <article className="h-[100dvh] w-full relative flex flex-col snap-start bg-black">
        {/* Flyer area - fills most of viewport */}
        <button
          type="button"
          onClick={() => hasImage && !imageIsVideo && setLightboxOpen(true)}
          className="flex-1 relative overflow-hidden"
          aria-label={hasImage && imageIsVideo ? "Video preview" : "View full flyer"}
        >
          {hasImage ? (
            imageIsVideo ? (
              <video
                src={event.image_url!}
                className="absolute inset-0 w-full h-full object-contain"
                muted
                loop
                playsInline
                autoPlay
              />
            ) : (
              <ImmersiveImage src={event.image_url!} alt={event.title}>
                {/* Expand icon - top right, below floating header */}
                <div className="absolute top-16 right-4 bg-black/50 rounded-full p-2.5 z-20">
                  <Expand className="w-5 h-5 text-white" />
                </div>
              </ImmersiveImage>
            )
          ) : (
            /* Default image when no event image is provided */
            <EventDefaultImage
              title={event.title}
              className="absolute inset-0 w-full h-full object-contain"
              priority
            />
          )}
        </button>

        {/* Info area with gradient overlay - clickable to event page */}
        <Link
          href={`/events/${event.slug}`}
          prefetch={false}
          className="absolute bottom-0 inset-x-0"
        >
          <div className="bg-gradient-to-t from-black via-black/80 to-transparent pt-20 pb-8 px-5">
            <h2 className="text-white font-semibold text-2xl mb-3 line-clamp-2 drop-shadow-lg">
              {event.title}
            </h2>

            <div className="flex flex-col gap-2 text-white/90">
              <div className="flex items-center gap-2.5 drop-shadow-md">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">
                  {formatInDaLat(event.starts_at, "EEE, MMM d")} &middot;{" "}
                  {formatInDaLat(event.starts_at, "h:mm a")}
                </span>
              </div>

              {event.location_name && (
                <div className="flex items-center gap-2.5 drop-shadow-md">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm line-clamp-1">{event.location_name}</span>
                </div>
              )}

              <div className="flex items-center gap-2.5 drop-shadow-md">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">
                  {spotsText} going
                  {isFull && (
                    <span className="ml-1 text-orange-400">(Full)</span>
                  )}
                  {(counts?.interested_count ?? 0) > 0 && (
                    <span className="ml-1 text-white/70">
                      &middot; {counts?.interested_count} interested
                    </span>
                  )}
                  {(counts?.waitlist_count ?? 0) > 0 && (
                    <span className="ml-1 text-white/70">
                      &middot; {counts?.waitlist_count} waitlist
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </Link>
      </article>

      {/* Lightbox for full image view */}
      {hasImage && !imageIsVideo && (
        <ImageLightbox
          src={event.image_url!}
          alt={event.title}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
