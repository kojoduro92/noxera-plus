import React from "react";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Members</h3>
          <p className="text-3xl font-bold mt-2 text-indigo-600">1,245</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">New Visitors</h3>
          <p className="text-3xl font-bold mt-2 text-indigo-600">12</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Avg Attendance</h3>
          <p className="text-3xl font-bold mt-2 text-indigo-600">840</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Monthly Giving</h3>
          <p className="text-3xl font-bold mt-2 text-indigo-600">$14,500</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Recent Follow-ups</h3>
          <p className="text-gray-500 text-sm">No pending follow-ups for this week.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Upcoming Services</h3>
          <ul className="space-y-3">
            <li className="flex justify-between items-center text-sm">
              <span className="font-medium">Sunday First Service</span>
              <span className="text-gray-500">Oct 12, 9:00 AM</span>
            </li>
            <li className="flex justify-between items-center text-sm">
              <span className="font-medium">Sunday Second Service</span>
              <span className="text-gray-500">Oct 12, 11:30 AM</span>
            </li>
            <li className="flex justify-between items-center text-sm">
              <span className="font-medium">Midweek Service</span>
              <span className="text-gray-500">Oct 15, 6:30 PM</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
