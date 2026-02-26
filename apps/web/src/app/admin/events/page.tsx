"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";

type EventRow = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: string;
  endDate: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function toInputDateTime(value: string) {
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function EventsPage() {
  const { selectedBranchId } = useBranch();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [activeEvent, setActiveEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "upcoming" | "past">("all");

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(() => toInputDateTime(new Date().toISOString()));
  const [endDate, setEndDate] = useState(() => toInputDateTime(new Date(Date.now() + 60 * 60 * 1000).toISOString()));

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    try {
      const payload = await apiFetch<EventRow[]>(`/api/admin/events${query}`, { cache: "no-store" });
      setEvents(payload);
    } catch (err) {
      setEvents([]);
      setError(getErrorMessage(err, "Unable to load events."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => {
        const start = new Date(event.startDate).getTime();
        if (dateFilter === "upcoming" && start < now) return false;
        if (dateFilter === "past" && start >= now) return false;
        if (!search.trim()) return true;
        const query = search.trim().toLowerCase();
        return event.title.toLowerCase().includes(query) || (event.location || "").toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [dateFilter, events, search]);

  const groupedCalendar = useMemo(() => {
    return filteredEvents.reduce<Record<string, EventRow[]>>((acc, event) => {
      const day = new Date(event.startDate).toDateString();
      acc[day] = acc[day] ?? [];
      acc[day].push(event);
      return acc;
    }, {});
  }, [filteredEvents]);

  const upcomingCount = useMemo(() => events.filter((event) => new Date(event.startDate).getTime() >= Date.now()).length, [events]);

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Event title is required.");
      return;
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setError("End date must be after start date.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await apiFetch<EventRow>("/api/admin/events", {
        method: "POST",
        ...withJsonBody({
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          branchId: selectedBranchId,
        }),
      });
      setNotice("Event created.");
      setTitle("");
      setDescription("");
      setLocation("");
      setStartDate(toInputDateTime(new Date().toISOString()));
      setEndDate(toInputDateTime(new Date(Date.now() + 60 * 60 * 1000).toISOString()));
      await loadEvents();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create event."));
    } finally {
      setSubmitting(false);
    }
  };

  const openEvent = async (id: string) => {
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    setError("");
    try {
      const payload = await apiFetch<EventRow>(`/api/admin/events/${id}${query}`, { cache: "no-store" });
      setActiveEvent(payload);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load event details."));
      setActiveEvent(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Events Planning</p>
        <h2 className="mt-2 text-2xl font-black">Run church calendar operations with branch-aware schedules.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Switch between list and calendar views while keeping event details actionable.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Events</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{events.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upcoming</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{upcomingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current View</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{viewMode === "list" ? "List" : "Calendar"}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">Events Directory</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider ${viewMode === "list" ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-700"}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider ${viewMode === "calendar" ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-700"}`}
              >
                Calendar
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as "all" | "upcoming" | "past")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
            <button type="button" onClick={() => void loadEvents()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              Refresh
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <p className="py-8 text-center text-sm font-medium text-slate-500">No events match your filter yet.</p>
            ) : viewMode === "list" ? (
              <ul className="space-y-2">
                {filteredEvents.map((event) => (
                  <li key={event.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{event.title}</p>
                      <p className="text-xs text-slate-600">
                        {new Date(event.startDate).toLocaleString()} - {new Date(event.endDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button type="button" onClick={() => void openEvent(event.id)} className="text-xs font-bold text-indigo-600 hover:text-indigo-500">
                      View
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedCalendar).map(([date, dayEvents]) => (
                  <div key={date} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">{date}</p>
                    <ul className="mt-2 space-y-2">
                      {dayEvents.map((event) => (
                        <li key={event.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                          <span className="text-sm font-semibold text-slate-800">{event.title}</span>
                          <button type="button" onClick={() => void openEvent(event.id)} className="text-xs font-bold text-indigo-600 hover:text-indigo-500">
                            Details
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <form onSubmit={createEvent} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Create Event</h3>
            <div className="mt-4 grid gap-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Event title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Description" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <button type="submit" disabled={submitting} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Saving..." : "Create Event"}
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Event Detail</h3>
            {!activeEvent ? (
              <p className="mt-3 text-sm text-slate-500">Select any event from the list/calendar to preview details.</p>
            ) : (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-base font-black text-slate-900">{activeEvent.title}</p>
                <p className="mt-1 text-xs text-slate-600">{new Date(activeEvent.startDate).toLocaleString()} - {new Date(activeEvent.endDate).toLocaleString()}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{activeEvent.location || "Location not specified"}</p>
                <p className="mt-3 text-sm text-slate-700">{activeEvent.description || "No description added yet."}</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}
    </div>
  );
}
