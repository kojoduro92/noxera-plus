"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { PlatformPersonalizationProvider } from "@/contexts/PlatformPersonalizationContext";
import { FaviconSync } from "@/components/FaviconSync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PlatformPersonalizationProvider>
      <FaviconSync />
      <AuthProvider>
        <BranchProvider>{children}</BranchProvider>
      </AuthProvider>
    </PlatformPersonalizationProvider>
  );
}
