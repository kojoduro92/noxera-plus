"use client";

import React, { useState, useEffect } from "react";
import { useBranch } from "@/contexts/BranchContext";

// Mock data
const mockMembers = [
  { id: "1", firstName: "John", lastName: "Doe", phone: "123-456-7890", email: "john@example.com", status: "Active", branchId: "branch1" },
  { id: "2", firstName: "Jane", lastName: "Smith", phone: "098-765-4321", email: "jane@example.com", status: "Active", branchId: "branch1" },
  { id: "3", firstName: "Peter", lastName: "Jones", phone: "111-222-3333", email: "peter@example.com", status: "Active", branchId: "branch2" },
];

export default function MembersPage() {
  const { selectedBranchId } = useBranch();
  const [members, setMembers] = useState(mockMembers);

  // In a real application, fetch members based on selectedBranchId
  // useEffect(() => {
  //   const fetchMembers = async () => {
  //     const headers: Record<string, string> = { "x-tenant-id": "current-tenant-id" };
  //     if (selectedBranchId) {
  //       headers["x-branch-id"] = selectedBranchId;
  //     }
  //     const res = await fetch("/api/members", { headers });
  //     const data = await res.json();
  //     setMembers(data);
  //   };
  //   fetchMembers();
  // }, [selectedBranchId]);

  const filteredMembers = selectedBranchId
    ? members.filter((member) => member.branchId === selectedBranchId)
    : members;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Members Directory</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          Add Member
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMembers.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  {member.firstName} {member.lastName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.email} <br />
                  <span className="text-xs text-gray-400">{member.phone}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
