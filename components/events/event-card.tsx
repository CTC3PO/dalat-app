"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, Users, Expand } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { EventDefaultImage } from "@/components/events/event-default-image";
import { formatInDaLat } from "@/lib/timezone";
import { isVideoUrl } from "@/lib/media-utils";
import type { Event, EventCounts } from "@/lib/types";

interface EventCardProps {
  event: Event;
  counts?: EventCounts;
}

export function EventCard({ event, counts }: EventCardProps) {
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
      <Card className="overflow-hidden hover:border-foreground/20 transition-colors">
        {/* Image area - opens lightbox */}
        <button
          type="button"
          onClick={() => hasImage && !imageIsVideo && setLightboxOpen(true)}
          className="w-full aspect-[4/5] relative overflow-hidden group cursor-pointer"
          aria-label={hasImage && imageIsVideo ? "Video preview" : "View full flyer"}
        >
          {hasImage ? (
            imageIsVideo ? (
              <video
                src={event.image_url!}
                className="object-cover w-full h-full"
                muted
                loop
                playsInline
                autoPlay
              />
            ) : (
              <>
                <img
                  src={event.image_url!}
                  alt={event.title}
                  className="object-cover w-full h-full transition-transform group-hover:scale-105"
                />
                {/* Expand icon on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-2">
                    <Expand className="w-5 h-5 text-white" />
                  </div>
                </div>
              </>
            )
          ) : (
            /* Default image when no event image is provided */
            <EventDefaultImage
              title={event.title}
              className="object-cover w-full h-full"
            />
          )}
        </button>

        {/* Text area - navigates to event page */}
        <Link href={`/events/${event.slug}`} prefetch={false}>
          <CardContent className="p-4 hover:bg-muted/50 transition-colors">
            <h3 className="font-semibold text-lg mb-2 line-clamp-1">
              {event.title}
            </h3>

            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {formatInDaLat(event.starts_at, "EEE, MMM d")} &middot;{" "}
                  {formatInDaLat(event.starts_at, "h:mm a")}
                </span>
              </div>

              {event.location_name && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span className="line-clamp-1">{event.location_name}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>
                  {spotsText} going
                  {isFull && (
                    <span className="ml-1 text-orange-500">(Full)</span>
                  )}
                  {(counts?.interested_count ?? 0) > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      &middot; {counts?.interested_count} interested
                    </span>
                  )}
                  {(counts?.waitlist_count ?? 0) > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      &middot; {counts?.waitlist_count} waitlist
                    </span>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>

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
