"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Place {
  placeId: string;
  name: string;
  address: string;
  googleMapsUrl: string;
}

interface PlaceAutocompleteProps {
  onPlaceSelect: (place: Place | null) => void;
  defaultValue?: Place | null;
}

// Cost safeguards:
// 1. Debounce: 300ms delay before searching
// 2. Min chars: Only search after 3+ characters
// 3. Session tokens: Bundle autocomplete + details into one billing session
// 4. Restrict to Vietnam: Fewer results
// 5. Limit fields: Only request what we need

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

export function PlaceAutocomplete({ onPlaceSelect, defaultValue }: PlaceAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue?.name || "");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(defaultValue || null);

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Google Places services
  useEffect(() => {
    if (typeof google === "undefined") {
      // Load Google Maps script
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = initServices;
      document.head.appendChild(script);
    } else {
      initServices();
    }

    function initServices() {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      // PlacesService needs a DOM element (can be hidden)
      const div = document.createElement("div");
      placesService.current = new google.maps.places.PlacesService(div);
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchPlaces = useCallback((searchQuery: string) => {
    if (!autocompleteService.current || searchQuery.length < MIN_CHARS) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    autocompleteService.current.getPlacePredictions(
      {
        input: searchQuery,
        sessionToken: sessionToken.current!,
        componentRestrictions: { country: "vn" }, // Restrict to Vietnam
        types: ["establishment", "geocode"], // Places and addresses
      },
      (predictions, status) => {
        setIsLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
          setIsOpen(true);
        } else {
          setSuggestions([]);
        }
      }
    );
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear selection when typing
    if (selectedPlace) {
      setSelectedPlace(null);
      onPlaceSelect(null);
    }

    // Debounce the search
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (value.length >= MIN_CHARS) {
      debounceTimer.current = setTimeout(() => {
        searchPlaces(value);
      }, DEBOUNCE_MS);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelectPlace = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current) return;

    setIsLoading(true);
    setIsOpen(false);

    // Get place details (uses same session token = bundled billing)
    placesService.current.getDetails(
      {
        placeId: prediction.place_id,
        sessionToken: sessionToken.current!,
        fields: ["name", "formatted_address", "place_id", "url"], // Only what we need
      },
      (place, status) => {
        setIsLoading(false);

        // Create new session token for next search
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();

        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const selectedPlaceData: Place = {
            placeId: place.place_id || prediction.place_id,
            name: place.name || prediction.structured_formatting.main_text,
            address: place.formatted_address || prediction.description,
            googleMapsUrl: place.url || `https://www.google.com/maps/place/?q=place_id:${prediction.place_id}`,
          };

          setQuery(place.name || prediction.structured_formatting.main_text);
          setSelectedPlace(selectedPlaceData);
          onPlaceSelect(selectedPlaceData);
        }
      }
    );
  };

  const handleClear = () => {
    setQuery("");
    setSelectedPlace(null);
    setSuggestions([]);
    onPlaceSelect(null);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative space-y-2">
      <Label htmlFor="place">Location *</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="place"
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder="Search for a place in Vietnam..."
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {!isLoading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Selected place info */}
      {selectedPlace && (
        <p className="text-sm text-muted-foreground">{selectedPlace.address}</p>
      )}

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((prediction) => (
            <li key={prediction.place_id}>
              <button
                type="button"
                onClick={() => handleSelectPlace(prediction)}
                className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
              >
                <p className="font-medium text-sm">
                  {prediction.structured_formatting.main_text}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {prediction.structured_formatting.secondary_text}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Hidden inputs for form submission */}
      <input type="hidden" name="location_name" value={selectedPlace?.name || ""} />
      <input type="hidden" name="address" value={selectedPlace?.address || ""} />
      <input type="hidden" name="google_maps_url" value={selectedPlace?.googleMapsUrl || ""} />
    </div>
  );
}
