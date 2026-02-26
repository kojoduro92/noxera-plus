"use client";

import React, { useState } from "react";
import { useBranch } from "@/contexts/BranchContext";

const mockServices = [
  { id: "1", name: "Sunday Morning Service", date: "2026-10-12T09:00:00Z", attendanceCount: 420, branchId: "branch1" },
  { id: "2", name: "Sunday Midday Service", date: "2026-10-12T11:30:00Z", attendanceCount: 315, branchId: "branch1" },
  { id: "3", name: "Midweek Bible Study", date: "2026-10-15T18:30:00Z", attendanceCount: 150, branchId: "branch2" },
];

export default function ServicesPage() {
  const { selectedBranchId } = useBranch();
  const [services] = useState(mockServices);

  const filteredServices = selectedBranchId
    ? services.filter((service) => service.branchId === selectedBranchId)
    : services;


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Services & Attendance</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          Schedule Service
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Attendance</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredServices.map((service) => {
              const d = new Date(service.date);
              return (
                <tr key={service.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {service.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {d.toLocaleDateString()} at {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {service.attendanceCount} check-ins
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900 mr-4">Check-in Kiosk</button>
                    <button className="text-gray-600 hover:text-gray-900">Report</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
