"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface BranchContextType {
  selectedBranchId: string | undefined;
  setSelectedBranchId: (branchId: string | undefined) => void;
  setScope: (scopeKey: string, defaultBranchId?: string) => void;
}

const BranchContext = createContext<BranchContextType>({
  selectedBranchId: undefined,
  setSelectedBranchId: () => {},
  setScope: () => {},
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(undefined);
  const [scopeKey, setScopeKey] = useState("global");
  const getStorageKey = useCallback((key: string) => `selectedBranchId:${key}`, []);

  const setScope = useCallback(
    (nextScopeKey: string, defaultBranchId?: string) => {
      const normalizedScope = nextScopeKey.trim() || "global";
      setScopeKey(normalizedScope);
      if (typeof window === "undefined") {
        setSelectedBranchId(defaultBranchId);
        return;
      }

      const storedBranchId = window.localStorage.getItem(getStorageKey(normalizedScope));
      if (storedBranchId) {
        setSelectedBranchId(storedBranchId);
      } else {
        setSelectedBranchId(defaultBranchId);
      }
    },
    [getStorageKey],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedBranchId = window.localStorage.getItem(getStorageKey(scopeKey));
    if (storedBranchId) {
      setSelectedBranchId(storedBranchId);
    } else {
      setSelectedBranchId(undefined);
    }
  }, [getStorageKey, scopeKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = getStorageKey(scopeKey);
    if (selectedBranchId !== undefined) {
      window.localStorage.setItem(storageKey, selectedBranchId);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  }, [getStorageKey, scopeKey, selectedBranchId]);

  return (
    <BranchContext.Provider value={{ selectedBranchId, setSelectedBranchId, setScope }}>
      {children}
    </BranchContext.Provider>
  );
};
