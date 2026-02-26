"use client";

import React, { useState } from "react";
import { useBranch } from "@/contexts/BranchContext";

const mockMessages = [
  {
    id: "1",
    type: "EMAIL",
    subject: "Sunday Service Reminder",
    audience: "All Members",
    status: "Sent",
    sentAt: "2026-10-10T08:00:00Z",
    branchId: "branch1",
    body: "Join us for Sunday worship at 10 AM with live worship and a new message from Pastor Jade.",
  },
  {
    id: "2",
    type: "SMS",
    subject: "",
    audience: "Youth Group",
    status: "Sent",
    sentAt: "2026-10-09T14:30:00Z",
    branchId: "branch1",
    body: "Drop by the youth hangout at 4 PM for pizza and games!",
  },
  {
    id: "3",
    type: "EMAIL",
    subject: "Midweek Bible Study",
    audience: "Leaders",
    status: "Draft",
    sentAt: null,
    branchId: "branch2",
    body: "Reminder: Leaders preview night is Wednesday at 7 PM. RSVP by Tuesday.",
  },
];

export default function CommunicationPage() {
  const { selectedBranchId } = useBranch();
  const [messages] = useState(mockMessages);

  const filteredMessages = selectedBranchId
    ? messages.filter((msg) => msg.branchId === selectedBranchId)
    : messages;

  const [messageType, setMessageType] = useState("EMAIL");
  const [audience, setAudience] = useState("All Members");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const handleSendMessage = () => {
    alert(`Sending ${messageType} to ${audience} with subject "${subject}" and body "${body}"`);
    // In a real app, this would call our /api/messages endpoint
    // After sending, you would typically add to mockMessages or refetch
    setSubject("");
    setBody("");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Communication Center</h2>

      {/* New Message Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Create New Message</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Message Type</label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Audience</label>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="e.g., All Members, Youth Group, [tag1,tag2]"
            />
          </div>
          {messageType === "EMAIL" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Subject of your email"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Your message content..."
            />
          </div>
          <button
            onClick={handleSendMessage}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 w-full"
          >
            Send Message
          </button>
        </div>
      </div>

      {/* Message History */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Message History</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Audience</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject/Body Preview</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent At</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMessages.map((msg) => (
              <tr key={msg.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {msg.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {msg.audience}
                </td>
                <td className="px-6 py-4 max-w-sm truncate text-sm text-gray-500">
                  {msg.type === "EMAIL" ? msg.subject : msg.body.substring(0, 50) + "..."}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {msg.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
