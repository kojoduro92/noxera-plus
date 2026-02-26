"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";

type MessageRow = {
  id: string;
  type: string;
  audience: string;
  subject?: string | null;
  body: string;
  status: string;
  sentAt?: string | null;
  createdAt: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

export default function CommunicationPage() {
  const { selectedBranchId } = useBranch();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [type, setType] = useState("EMAIL");
  const [audience, setAudience] = useState("All Members");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    try {
      const payload = await apiFetch<MessageRow[]>(`/api/admin/messages${query}`, { cache: "no-store" });
      setMessages(payload);
    } catch (err) {
      setMessages([]);
      setError(getErrorMessage(err, "Unable to load communication campaigns."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const filtered = useMemo(
    () => messages.filter((message) => (statusFilter === "all" ? true : message.status === statusFilter)),
    [messages, statusFilter],
  );

  const activeMessage = useMemo(() => messages.find((message) => message.id === activeMessageId) ?? null, [activeMessageId, messages]);

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) {
      setError("Message body is required.");
      return;
    }

    if (type === "EMAIL" && !subject.trim()) {
      setError("Subject is required for email campaigns.");
      return;
    }

    setSavingDraft(true);
    setError("");
    setNotice("");

    try {
      const created = await apiFetch<MessageRow>("/api/admin/messages", {
        method: "POST",
        ...withJsonBody({
          type,
          audience: audience.trim() || "All Members",
          subject: type === "EMAIL" ? subject.trim() : undefined,
          body: body.trim(),
          branchId: selectedBranchId,
        }),
      });
      setNotice("Campaign saved as draft.");
      setSubject("");
      setBody("");
      setActiveMessageId(created.id);
      await loadMessages();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save draft."));
    } finally {
      setSavingDraft(false);
    }
  };

  const sendCampaign = async (messageId: string) => {
    setSendingId(messageId);
    setError("");
    setNotice("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";

    try {
      await apiFetch(`/api/admin/messages/${messageId}/send${query}`, { method: "PUT" });
      setNotice("Campaign sent.");
      await loadMessages();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to send campaign."));
    } finally {
      setSendingId(null);
    }
  };

  const updateStatus = async (messageId: string, nextStatus: string) => {
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    setError("");
    setNotice("");

    try {
      await apiFetch(`/api/admin/messages/${messageId}/status${query}`, {
        method: "PUT",
        ...withJsonBody({ status: nextStatus }),
      });
      setNotice(`Campaign status updated to ${nextStatus}.`);
      await loadMessages();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update campaign status."));
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Communication Center</p>
        <h2 className="mt-2 text-2xl font-black">Draft and deliver campaigns with real delivery statuses.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Use audience presets and dispatch controls to keep engagement operations predictable.</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <form onSubmit={saveDraft} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Create Campaign</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">Campaigns start as Draft and can be sent immediately after review.</p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
              <select value={audience} onChange={(event) => setAudience(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="All Members">All Members</option>
                <option value="New Members">New Members</option>
                <option value="Leaders">Leaders</option>
                <option value="Volunteers">Volunteers</option>
                <option value="Youth Ministry">Youth Ministry</option>
              </select>
            </div>
            {type === "EMAIL" && (
              <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Email subject" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            )}
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="Message body" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={savingDraft} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
            {savingDraft ? "Saving..." : "Save Draft"}
          </button>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Campaign Timeline</h3>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
              <option value="all">All</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          {activeMessage ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-900">{activeMessage.subject || "SMS Campaign"}</p>
              <p className="mt-1 text-xs text-slate-600">Audience: {activeMessage.audience}</p>
              <p className="mt-1 text-xs text-slate-600">Status: {activeMessage.status}</p>
              <p className="mt-1 text-xs text-slate-600">Created: {new Date(activeMessage.createdAt).toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-600">Sent: {activeMessage.sentAt ? new Date(activeMessage.sentAt).toLocaleString() : "Not sent"}</p>
              <p className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{activeMessage.body}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Select a campaign from the table to preview details.</p>
          )}
        </section>
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">Campaigns</h3>
          <button type="button" onClick={() => void loadMessages()} className="text-xs font-bold text-indigo-600 hover:text-indigo-500">
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Audience</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-4 py-4"><div className="h-4 w-12 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-28 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-36 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-16 animate-pulse rounded-full bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-200" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    No campaigns found for the selected status filter.
                  </td>
                </tr>
              ) : (
                filtered.map((message) => (
                  <tr key={message.id}>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">{message.type}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{message.audience}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{message.subject || `${message.body.slice(0, 28)}...`}</td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${message.status === "Sent" ? "bg-emerald-100 text-emerald-700" : message.status === "Failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {message.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setActiveMessageId(message.id)} className="text-indigo-600 hover:text-indigo-500">View</button>
                        {message.status !== "Sent" && (
                          <button type="button" onClick={() => void sendCampaign(message.id)} disabled={sendingId === message.id} className="text-emerald-600 hover:text-emerald-500 disabled:opacity-50">
                            {sendingId === message.id ? "Sending..." : "Send"}
                          </button>
                        )}
                        {message.status !== "Failed" && (
                          <button type="button" onClick={() => void updateStatus(message.id, "Failed")} className="text-red-600 hover:text-red-500">Fail</button>
                        )}
                        {message.status !== "Draft" && (
                          <button type="button" onClick={() => void updateStatus(message.id, "Draft")} className="text-slate-600 hover:text-slate-500">Draft</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
