"use client";

import React from 'react';

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <p className="mt-2 text-sm text-gray-500">
          Manage your church branches, roles, integrations, and billing information.
        </p>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold">Branch Management</h3>
          <p className="text-sm text-gray-600 mt-1">Configure your church campuses and locations.</p>
        </div>
      </div>
      
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold">Roles & Permissions</h3>
          <p className="text-sm text-gray-600 mt-1">Define custom roles and manage access control for your staff.</p>
        </div>
      </div>
      
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold">Integrations</h3>
          <p className="text-sm text-gray-600 mt-1">Connect with third-party services like accounting software or calendar apps.</p>
        </div>
      </div>
      
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold">Billing & Subscription</h3>
          <p className="text-sm text-gray-600 mt-1">View your current plan, manage payment methods, and see your invoice history.</p>
        </div>
      </div>
    </div>
  );
}
