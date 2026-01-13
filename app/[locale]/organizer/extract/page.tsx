"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PosterUpload } from "@/components/admin/poster-upload";
import { EventReviewCard } from "@/components/admin/event-review-card";
import { createClient } from "@/lib/supabase/client";
import type { ExtractedEventData, Organizer } from "@/lib/types";
import { Link } from "@/lib/i18n/routing";

type ExtractionState = "idle" | "uploading" | "extracted" | "publishing" | "done";

export default function OrganizerExtractPage() {
  const router = useRouter();
  const [state, setState] = useState<ExtractionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [events, setEvents] = useState<ExtractedEventData[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Only user's organizers
  const [myOrganizers, setMyOrganizers] = useState<Organizer[]>([]);
  const [selectedOrganizerId, setSelectedOrganizerId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Fetch user's organizers on mount
  useEffect(() => {
    const fetchMyOrganizers = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("organizers")
        .select("*")
        .eq("owner_id", user.id)
        .order("name");

      setMyOrganizers(data ?? []);

      // Auto-select if only one organizer
      if (data && data.length === 1) {
        setSelectedOrganizerId(data[0].id);
      }

      setLoading(false);
    };
    fetchMyOrganizers();
  }, []);

  const handleUpload = async (file: File) => {
    setState("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      if (selectedOrganizerId) {
        formData.append("organizer_id", selectedOrganizerId);
      }

      const response = await fetch("/api/extract-events", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Extraction failed");
      }

      setImageUrl(data.image_url);
      setExtractionId(data.extraction_id);
      setEvents(data.events);

      // Pre-select non-duplicate events
      const nonDuplicateIndices = new Set<number>();
      data.events.forEach((event: ExtractedEventData, index: number) => {
        if (!event.duplicate_of) {
          nonDuplicateIndices.add(index);
        }
      });
      setSelectedIndices(nonDuplicateIndices);

      setState("extracted");
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("idle");
    }
  };

  const handleToggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIndices(new Set(events.map((_, i) => i)));
  };

  const handleSelectNone = () => {
    setSelectedIndices(new Set());
  };

  const handleUpdateEvent = (index: number, updated: ExtractedEventData) => {
    setEvents((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const handlePublish = async () => {
    if (selectedIndices.size === 0) {
      setError("Select at least one event to publish");
      return;
    }

    setState("publishing");
    setError(null);

    try {
      const eventsToPublish = events.map((event, index) => ({
        title: event.title,
        description: event.description,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        location_name: event.location_name,
        address: event.address,
        organizer_id: selectedOrganizerId || undefined,
        skip: !selectedIndices.has(index),
      }));

      const response = await fetch("/api/events/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction_id: extractionId,
          events: eventsToPublish,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Publish failed");
      }

      setState("done");
    } catch (err) {
      console.error("Publish error:", err);
      setError(err instanceof Error ? err.message : "Publish failed");
      setState("extracted");
    }
  };

  const handleReset = () => {
    setState("idle");
    setError(null);
    setImageUrl(null);
    setExtractionId(null);
    setEvents([]);
    setSelectedIndices(new Set());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Done state
  if (state === "done") {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <div className="rounded-full bg-green-100 dark:bg-green-900/30 w-20 h-20 mx-auto flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Events Published!</h1>
          <p className="text-muted-foreground mt-2">
            {selectedIndices.size} events have been created successfully.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={handleReset}>Extract More</Button>
          <Button variant="outline" asChild>
            <Link href="/organizer/events">View Events</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/organizer"
            className="-ml-3 flex items-center gap-2 text-muted-foreground hover:text-foreground active:scale-95 transition-all px-3 py-2 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            AI Event Extraction
          </h1>
        </div>
        <p className="text-muted-foreground">
          Upload an event poster and let AI extract the events
        </p>
      </div>

      {/* Organizer selector - only shows if user has multiple organizers */}
      {myOrganizers.length > 1 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Publish as Organizer</label>
          <select
            value={selectedOrganizerId}
            onChange={(e) => setSelectedOrganizerId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={state !== "idle" && state !== "extracted"}
          >
            <option value="">Select organizer</option>
            {myOrganizers.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} {org.is_verified ? "✓" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Show which organizer events will be published under */}
      {myOrganizers.length === 1 && (
        <div className="text-sm text-muted-foreground">
          Events will be published under{" "}
          <span className="font-medium text-foreground">
            {myOrganizers[0].name}
          </span>
        </div>
      )}

      {/* No organizer warning */}
      {myOrganizers.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-yellow-700 dark:text-yellow-300 text-sm">
          No organizer profile linked to your account. Events will be created
          without an organizer.
        </div>
      )}

      {/* Upload / Preview area */}
      {state === "idle" || state === "uploading" ? (
        <PosterUpload onUpload={handleUpload} isUploading={state === "uploading"} />
      ) : (
        <div className="flex gap-4 items-start">
          {imageUrl && (
            <div className="shrink-0 w-48">
              <img
                src={imageUrl}
                alt="Uploaded poster"
                className="rounded-lg border w-full"
              />
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={handleReset}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Upload Different
              </Button>
            </div>
          )}

          <div className="flex-1 space-y-4">
            {/* Selection controls */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {events.length} events extracted, {selectedIndices.size} selected
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleSelectNone}>
                  Select None
                </Button>
              </div>
            </div>

            {/* Event cards */}
            <div className="space-y-3">
              {events.map((event, index) => (
                <EventReviewCard
                  key={index}
                  event={event}
                  index={index}
                  isSelected={selectedIndices.has(index)}
                  onToggleSelect={() => handleToggleSelect(index)}
                  onUpdate={(updated) => handleUpdateEvent(index, updated)}
                />
              ))}
            </div>

            {/* Publish button */}
            <div className="sticky bottom-4 bg-background/95 backdrop-blur p-4 rounded-lg border shadow-lg">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm">
                  <span className="font-medium">{selectedIndices.size}</span> events
                  will be published
                  {selectedOrganizerId && myOrganizers.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      under{" "}
                      <span className="font-medium">
                        {myOrganizers.find((o) => o.id === selectedOrganizerId)?.name}
                      </span>
                    </span>
                  )}
                </div>
                <Button
                  onClick={handlePublish}
                  disabled={state === "publishing" || selectedIndices.size === 0}
                  className="min-w-[120px]"
                >
                  {state === "publishing" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    "Publish Events"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-950/30 p-4 rounded-lg">
          <XCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
