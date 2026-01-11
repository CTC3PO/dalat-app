/**
 * Trigger haptic feedback on supported devices.
 * Falls back gracefully on unsupported platforms.
 */
export function triggerHaptic(style: "light" | "medium" | "selection" = "selection") {
  // Vibration API (Android, some browsers)
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const duration = style === "light" ? 5 : style === "medium" ? 10 : 3;
    navigator.vibrate(duration);
  }
}
