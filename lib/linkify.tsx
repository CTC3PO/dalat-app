import { ReactNode } from "react";

// Patterns for linkification
const URL_REGEX = /https?:\/\/[^\s<>]+/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+84|0)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}/g;

interface Match {
  type: "url" | "email" | "phone";
  value: string;
  index: number;
}

function findAllMatches(text: string): Match[] {
  const matches: Match[] = [];

  // Find URLs
  let match;
  while ((match = URL_REGEX.exec(text)) !== null) {
    matches.push({ type: "url", value: match[0], index: match.index });
  }

  // Find emails
  while ((match = EMAIL_REGEX.exec(text)) !== null) {
    // Skip if this position overlaps with a URL match
    const overlaps = matches.some(
      (m) =>
        m.type === "url" &&
        match!.index >= m.index &&
        match!.index < m.index + m.value.length
    );
    if (!overlaps) {
      matches.push({ type: "email", value: match[0], index: match.index });
    }
  }

  // Find phones
  while ((match = PHONE_REGEX.exec(text)) !== null) {
    matches.push({ type: "phone", value: match[0], index: match.index });
  }

  // Sort by position
  return matches.sort((a, b) => a.index - b.index);
}

function renderLink(match: Match, key: number): ReactNode {
  const baseClass = "text-primary hover:underline break-all";

  switch (match.type) {
    case "url":
      return (
        <a
          key={key}
          href={match.value}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClass}
        >
          {match.value}
        </a>
      );
    case "email":
      return (
        <a key={key} href={`mailto:${match.value}`} className={baseClass}>
          {match.value}
        </a>
      );
    case "phone": {
      // Strip non-digits for tel: href, keep original for display
      const digits = match.value.replace(/[^\d+]/g, "");
      return (
        <a key={key} href={`tel:${digits}`} className={baseClass}>
          {match.value}
        </a>
      );
    }
  }
}

interface LinkifyProps {
  text: string;
}

export function Linkify({ text }: LinkifyProps) {
  const matches = findAllMatches(text);

  if (matches.length === 0) {
    return <>{text}</>;
  }

  const elements: ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, i) => {
    // Add text before this match
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    // Add the link
    elements.push(renderLink(match, i));
    lastIndex = match.index + match.value.length;
  });

  // Add remaining text after last match
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return <>{elements}</>;
}
