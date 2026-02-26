"use client";

import { useEffect } from "react";
import { usePlatformPersonalization } from "@/contexts/PlatformPersonalizationContext";

const DEFAULT_FAVICON = "/brand-favicon.png";

export function FaviconSync() {
  const { personalization } = usePlatformPersonalization();

  useEffect(() => {
    const href = personalization.faviconUrl || personalization.logoUrl || DEFAULT_FAVICON;
    const doc = document;

    let icon = doc.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!icon) {
      icon = doc.createElement("link");
      icon.rel = "icon";
      doc.head.appendChild(icon);
    }

    icon.href = href;
  }, [personalization.faviconUrl, personalization.logoUrl]);

  return null;
}
