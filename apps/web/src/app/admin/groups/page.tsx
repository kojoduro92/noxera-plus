"use client";

import React, { useState } from "react";
import { useBranch } from "@/contexts/BranchContext";

const mockGroups = [
  { id: "1", name: "Youth Ministry", type: "Ministry", memberCount: 45, branchId: "branch1" },
  { id: "2", name: "Sunday Service Ushers", type: "Department", memberCount: 12, branchId: "branch1" },
  { id: "3", name: "Alpha Cell Group", type: "CellGroup", memberCount: 8, branchId: "branch2" },
];

export default function GroupsPage() {
  const { selectedBranchId } = useBranch();
  const [groups] = useState(mockGroups);

  const filteredGroups = selectedBranchId
    ? groups.filter((group) => group.branchId === selectedBranchId)
    : groups;


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Groups & Ministries</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          Create New Group
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredGroups.map((group) => (
              <tr key={group.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  {group.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    {group.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {group.memberCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-indigo-600 hover:text-indigo-900 mr-4">View Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
