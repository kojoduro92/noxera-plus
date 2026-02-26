"use client";

import Link from "next/link";
import React from "react";
import { BranchSelector } from "@/components/BranchSelector";
import { useBranch } from "@/contexts/BranchContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { selectedBranchId, setSelectedBranchId } = useBranch();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-indigo-800">
          Church Portal
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <Link href="/admin" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Dashboard
          </Link>
          <Link href="/admin/members" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Members
          </Link>
          <Link href="/admin/services" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Services & Attendance
          </Link>
          <Link href="/admin/groups" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Groups & Ministries
          </Link>
          <Link href="/admin/events" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Events & Programs
          </Link>
          <Link href="/admin/giving" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Giving & Finance
          </Link>
          <Link href="/admin/communication" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Communication Center
          </Link>
          <div className="my-4 border-t border-indigo-800" />
          <Link href="/admin/website" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Website Builder
          </Link>
          <Link href="/admin/reports" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Reports
          </Link>
          <Link href="/admin/settings" className="block px-4 py-2 rounded-md hover:bg-indigo-800 transition-colors">
            Settings
          </Link>
        </nav>
        <div className="p-4 border-t border-indigo-800 text-sm text-indigo-300">
          Logged in as Admin
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Grace Fellowship Church</h1>
          <div className="flex items-center space-x-4">
            {/* Branch Selector */}
            <BranchSelector selectedBranchId={selectedBranchId} onSelectBranch={setSelectedBranchId} />
            <button className="text-gray-500 hover:text-indigo-600">Notifications</button>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              A
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">{children}</div>
      </main>
    </div>
  );
}
