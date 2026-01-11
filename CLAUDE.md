# dalat.app Development Guidelines

## Mobile-First Touch Targets

All interactive elements must have a minimum touch target of 44x44px for mobile usability.

### Back Button Pattern

For back/navigation links in headers, use this pattern:

```tsx
<Link
  href="/"
  className="-ml-3 flex items-center gap-2 text-muted-foreground hover:text-foreground active:text-foreground active:scale-95 transition-all px-3 py-2 rounded-lg"
>
  <ArrowLeft className="w-4 h-4" />
  <span>Back</span>
</Link>
```

Key classes:
- `px-3 py-2` - Padding for ~44px touch target
- `-ml-3` - Negative margin to keep visual alignment at edge
- `active:scale-95` - Touch feedback (slight press effect)
- `active:text-foreground` - Color feedback on press
- `transition-all` - Smooth transitions
- `rounded-lg` - Subtle rounded corners for touch area

For icon-only buttons, use `p-2 -ml-2` instead.

### General Rules

1. All buttons and links should have padding, not just wrap their content tightly
2. Add `active:` states for immediate touch feedback on mobile
3. Use negative margins to maintain visual alignment when adding padding
4. Test on actual mobile devices - hover states don't help there
