"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { PlatformPersonalizationProvider } from "@/contexts/PlatformPersonalizationContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PlatformPersonalizationProvider>
      <AuthProvider>
        <BranchProvider>{children}</BranchProvider>
      </AuthProvider>
    </PlatformPersonalizationProvider>
  );
}
