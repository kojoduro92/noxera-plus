"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface BranchContextType {
  selectedBranchId: string | undefined;
  setSelectedBranchId: (branchId: string | undefined) => void;
  // Potentially add fetched branches data here too
}

const BranchContext = createContext<BranchContextType>({
  selectedBranchId: undefined,
  setSelectedBranchId: () => {},
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(undefined);

  // In a real app, you might try to load the last selected branch from local storage
  // useEffect(() => {
  //   const storedBranchId = localStorage.getItem("selectedBranchId");
  //   if (storedBranchId) {
  //     setSelectedBranchId(storedBranchId);
  //   }
  // }, []);

  // useEffect(() => {
  //   if (selectedBranchId !== undefined) {
  //     localStorage.setItem("selectedBranchId", selectedBranchId);
  //   } else {
  //     localStorage.removeItem("selectedBranchId");
  //   }
  // }, [selectedBranchId]);

  return (
    <BranchContext.Provider value={{ selectedBranchId, setSelectedBranchId }}>
      {children}
    </BranchContext.Provider>
  );
};
