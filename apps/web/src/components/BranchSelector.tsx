"use client";

import React, { useState, useEffect } from "react";

// Mock data for branches
const mockBranches = [
  { id: "branch1", name: "Main Campus" },
  { id: "branch2", name: "Downtown Campus" },
  { id: "branch3", name: "Online Only" },
];

interface BranchSelectorProps {
  selectedBranchId: string | undefined;
  onSelectBranch: (branchId: string | undefined) => void;
}

export function BranchSelector({ selectedBranchId, onSelectBranch }: BranchSelectorProps) {
  const [branches, setBranches] = useState(mockBranches);
  
  // In a real application, you would fetch branches from your API:
  // useEffect(() => {
  //   fetch("/api/branches", { headers: { "x-tenant-id": "current-tenant-id" } })
  //     .then((res) => res.json())
  //     .then((data) => setBranches(data));
  // }, []);

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="branch-select" className="text-sm font-medium text-gray-700">
        Branch:
      </label>
      <select
        id="branch-select"
        value={selectedBranchId || "all"}
        onChange={(e) => onSelectBranch(e.target.value === "all" ? undefined : e.target.value)}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
      >
        <option value="all">All Branches</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
