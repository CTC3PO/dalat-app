"use client";

import { useState, useRef } from "react";
import { ImageIcon, X, Plus, Loader2, GripVertical, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Sponsor, EventSponsor } from "@/lib/types";

interface SponsorFormProps {
  eventId: string;
  initialSponsors?: (EventSponsor & { sponsors: Sponsor })[];
  onChange: (sponsors: (EventSponsor & { sponsors: Sponsor })[]) => void;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function validateLogoFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Please upload a JPEG, PNG, WebP, or SVG image";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File size must be under 5MB";
  }
  return null;
}

export function SponsorForm({ eventId, initialSponsors = [], onChange }: SponsorFormProps) {
  const [sponsors, setSponsors] = useState<(EventSponsor & { sponsors: Sponsor })[]>(initialSponsors);
  const [isAdding, setIsAdding] = useState(false);
  const [newSponsor, setNewSponsor] = useState({ name: "", website_url: "", logo_url: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload logo to storage
  const uploadLogo = async (file: File): Promise<string | null> => {
    const validationError = validateLogoFile(file);
    if (validationError) {
      setError(validationError);
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `${eventId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("sponsor-logos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("sponsor-logos")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      console.error("Logo upload error:", err);
      setError("Failed to upload logo");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await uploadLogo(file);
      if (url) {
        setNewSponsor(prev => ({ ...prev, logo_url: url }));
      }
    }
    e.target.value = "";
  };

  const handleAddSponsor = async () => {
    if (!newSponsor.name.trim()) {
      setError("Sponsor name is required");
      return;
    }

    setError(null);

    try {
      const supabase = createClient();

      // Create the sponsor
      const { data: sponsorData, error: sponsorError } = await supabase
        .from("sponsors")
        .insert({
          name: newSponsor.name.trim(),
          logo_url: newSponsor.logo_url || null,
          website_url: newSponsor.website_url.trim() || null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (sponsorError) throw sponsorError;

      // Link to event
      const sortOrder = sponsors.length;
      const { error: linkError } = await supabase
        .from("event_sponsors")
        .insert({
          event_id: eventId,
          sponsor_id: sponsorData.id,
          sort_order: sortOrder,
        });

      if (linkError) throw linkError;

      // Update local state
      const newEventSponsor: EventSponsor & { sponsors: Sponsor } = {
        event_id: eventId,
        sponsor_id: sponsorData.id,
        sort_order: sortOrder,
        created_at: new Date().toISOString(),
        sponsors: sponsorData,
      };

      const updatedSponsors = [...sponsors, newEventSponsor];
      setSponsors(updatedSponsors);
      onChange(updatedSponsors);

      // Reset form
      setNewSponsor({ name: "", website_url: "", logo_url: "" });
      setIsAdding(false);
    } catch (err) {
      console.error("Error adding sponsor:", err);
      setError("Failed to add sponsor");
    }
  };

  const handleRemoveSponsor = async (sponsorId: string) => {
    try {
      const supabase = createClient();

      const { error: deleteError } = await supabase
        .from("event_sponsors")
        .delete()
        .eq("event_id", eventId)
        .eq("sponsor_id", sponsorId);

      if (deleteError) throw deleteError;

      const updatedSponsors = sponsors.filter(s => s.sponsor_id !== sponsorId);
      setSponsors(updatedSponsors);
      onChange(updatedSponsors);
    } catch (err) {
      console.error("Error removing sponsor:", err);
      setError("Failed to remove sponsor");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Sponsors</Label>
        {!isAdding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add sponsor
          </Button>
        )}
      </div>

      {/* Existing sponsors list */}
      {sponsors.length > 0 && (
        <div className="space-y-2">
          {sponsors.map((es) => (
            <div
              key={es.sponsor_id}
              className="flex items-center gap-3 p-3 border rounded-lg bg-card"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />

              {/* Logo */}
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {es.sponsors?.logo_url ? (
                  <img
                    src={es.sponsors.logo_url}
                    alt={es.sponsors.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {/* Name & link */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{es.sponsors?.name}</p>
                {es.sponsors?.website_url && (
                  <a
                    href={es.sponsors.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="truncate">{es.sponsors.website_url}</span>
                  </a>
                )}
              </div>

              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveSponsor(es.sponsor_id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new sponsor form */}
      {isAdding && (
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="flex items-start gap-4">
            {/* Logo upload */}
            <div
              className={cn(
                "w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors flex-shrink-0",
                newSponsor.logo_url ? "border-transparent" : "border-muted-foreground/25 hover:border-muted-foreground/50"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : newSponsor.logo_url ? (
                <img
                  src={newSponsor.logo_url}
                  alt="Logo preview"
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground mx-auto" />
                  <span className="text-xs text-muted-foreground">Logo</span>
                </div>
              )}
            </div>

            {/* Name & URL inputs */}
            <div className="flex-1 space-y-3">
              <Input
                placeholder="Sponsor name *"
                value={newSponsor.name}
                onChange={(e) => setNewSponsor(prev => ({ ...prev, name: e.target.value }))}
              />
              <Input
                type="url"
                placeholder="Website URL (optional)"
                value={newSponsor.website_url}
                onChange={(e) => setNewSponsor(prev => ({ ...prev, website_url: e.target.value }))}
              />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewSponsor({ name: "", website_url: "", logo_url: "" });
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddSponsor}
              disabled={isUploading || !newSponsor.name.trim()}
            >
              Add sponsor
            </Button>
          </div>
        </div>
      )}

      {sponsors.length === 0 && !isAdding && (
        <p className="text-sm text-muted-foreground">
          No sponsors added yet. Add sponsors to give them visibility on your event page.
        </p>
      )}
    </div>
  );
}
