"use client";

import React, { useState } from "react";
import { useBranch } from "@/contexts/BranchContext";

const mockGiving = [
  { id: "1", date: "2026-10-12", amount: 500, fund: "Tithe", donor: "John Doe", method: "Cash", branchId: "branch1" },
  { id: "2", date: "2026-10-12", amount: 150, fund: "Offering", donor: "Anonymous", method: "Cash", branchId: "branch1" },
  { id: "3", date: "2026-10-14", amount: 1000, fund: "Building Fund", donor: "Jane Smith", method: "Check", branchId: "branch2" },
];

export default function GivingPage() {
  const { selectedBranchId } = useBranch();
  const [giving] = useState(mockGiving);

  const filteredGiving = selectedBranchId
    ? giving.filter((record) => record.branchId === selectedBranchId)
    : giving;


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Giving & Finance (Manual Entry)</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          Record Transaction
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Tithes (MTD)</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">$8,500</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Offerings (MTD)</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">$3,200</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Special Funds (MTD)</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">$2,800</p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Donor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fund</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredGiving.map((record) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {record.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  {record.donor}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                    {record.fund}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {record.method}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                  ${record.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
