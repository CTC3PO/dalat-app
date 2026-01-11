# Event Default Images

## Overview
This folder contains the default images used when events don't have a custom flyer/image.

## Files
- `event-default-desktop.png` - 16:9 landscape version optimized for desktop/tablet
- `event-default-mobile.png` - 9:16 portrait version optimized for mobile devices

## Design
The images feature a dreamy, cinematic view of Đà Lạt with:
- Misty pine-covered mountains at golden hour
- Vietnamese coffee phin (drip filter) and hydrangeas
- Bokeh lights suggesting community gatherings
- Gradient overlay from deep purple to warm orange/gold
- DaLat.app branding (only D and L capitalized)

## Usage
The responsive image system automatically serves:
- **Mobile version** for screens < 768px wide
- **Desktop version** for screens ≥ 768px wide

### In Components
```tsx
import { EventDefaultImage } from "@/components/events/event-default-image";

<EventDefaultImage 
  title={event.title} 
  className="object-cover w-full h-full"
  priority={false} // Set to true for above-the-fold images
/>
```

## Integration
Default images are automatically used in:
- `EventCard` component (regular grid view)
- `EventCardImmersive` component (full-screen mobile view)

When an event doesn't have an `image_url`, these fallback images are displayed instead of a blank space.
