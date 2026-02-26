"use client";

import React from "react";

export default function CustomReportingPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Custom Report Builder</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          Generate New Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-4 text-gray-700">1. Select Data Source</h3>
          <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option>Members Growth</option>
            <option>Attendance Trends</option>
            <option>Giving Analysis</option>
            <option>Group Engagement</option>
          </select>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-4 text-gray-700">2. Select Timeframe</h3>
          <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option>Last 30 Days</option>
            <option>Last Quarter</option>
            <option>Year to Date</option>
            <option>Custom Range</option>
          </select>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-4 text-gray-700">3. Select Format</h3>
          <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option>PDF Document</option>
            <option>CSV Spreadsheet</option>
            <option>Interactive Chart</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-100 h-64 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
        <p className="text-gray-500 italic">Report preview will appear here...</p>
      </div>
    </div>
  );
}
