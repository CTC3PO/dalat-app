"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Calendar, CalendarPlus, Check, Repeat, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getShortRRuleLabel } from "@/lib/recurrence";
import type { EventSeries } from "@/lib/types";

interface SeriesRsvpModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: Pick<EventSeries, "id" | "slug" | "title" | "rrule">;
  eventDate: string; // The date of the event they just RSVPed to
}

type RsvpChoice = "this_only" | "all_future" | "calendar";

export function SeriesRsvpModal({
  isOpen,
  onClose,
  series,
  eventDate,
}: SeriesRsvpModalProps) {
  const router = useRouter();
  const t = useTranslations("series.rsvpModal");
  const [loading, setLoading] = useState<RsvpChoice | null>(null);
  const [completed, setCompleted] = useState<RsvpChoice | null>(null);

  const recurrenceLabel = getShortRRuleLabel(series.rrule);

  const handleChoice = async (choice: RsvpChoice) => {
    setLoading(choice);

    try {
      if (choice === "this_only") {
        // Already RSVPed to this event, just close
        setCompleted(choice);
        setTimeout(() => {
          onClose();
          setCompleted(null);
        }, 1000);
        return;
      }

      if (choice === "all_future") {
        // Subscribe to series
        const response = await fetch(`/api/series/${series.slug}/rsvp`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to subscribe");
        }

        setCompleted(choice);
        setTimeout(() => {
          onClose();
          setCompleted(null);
          router.refresh();
        }, 1500);
        return;
      }

      if (choice === "calendar") {
        // Download ICS file
        window.location.href = `/api/series/${series.slug}/calendar.ics`;
        setCompleted(choice);
        setTimeout(() => {
          onClose();
          setCompleted(null);
        }, 1000);
        return;
      }
    } catch (error) {
      console.error("RSVP choice error:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description", { pattern: recurrenceLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Just this event */}
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={() => handleChoice("this_only")}
            disabled={loading !== null}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {loading === "this_only" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : completed === "this_only" ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Calendar className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="text-left">
                <p className="font-medium">{t("justThisEvent")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("justThisEventDesc", { date: eventDate })}
                </p>
              </div>
              {completed !== "this_only" && (
                <Check className="w-5 h-5 ml-auto text-green-500" />
              )}
            </div>
          </Button>

          {/* RSVP all future */}
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={() => handleChoice("all_future")}
            disabled={loading !== null}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {loading === "all_future" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : completed === "all_future" ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Repeat className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="text-left">
                <p className="font-medium">{t("allFutureEvents")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("allFutureEventsDesc")}
                </p>
              </div>
            </div>
          </Button>

          {/* Add to calendar */}
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={() => handleChoice("calendar")}
            disabled={loading !== null}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {loading === "calendar" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : completed === "calendar" ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <CalendarPlus className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="text-left">
                <p className="font-medium">{t("addToCalendar")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("addToCalendarDesc")}
                </p>
              </div>
            </div>
          </Button>
        </div>

        <div className="pt-2 border-t">
          <Button variant="ghost" onClick={onClose} className="w-full">
            {t("done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
