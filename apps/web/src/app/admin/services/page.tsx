"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";

type ServiceRow = {
  id: string;
  name: string;
  date: string;
  branchId?: string | null;
};

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type AttendanceRow = {
  id: string;
  serviceId: string;
  memberId?: string | null;
  visitorId?: string | null;
  method: string;
  createdAt: string;
  member?: {
    firstName: string;
    lastName: string;
  } | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function toInputDateTime(value: string) {
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function ServicesPage() {
  const { selectedBranchId } = useBranch();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDate, setNewServiceDate] = useState(() => toInputDateTime(new Date().toISOString()));
  const [creatingService, setCreatingService] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "upcoming" | "past">("all");

  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [checkInMode, setCheckInMode] = useState<"member" | "visitor">("member");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [visitorId, setVisitorId] = useState("");
  const [checkInMethod, setCheckInMethod] = useState("manual");
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    const branchQuery = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";

    try {
      const [servicePayload, attendancePayload, membersPayload] = await Promise.all([
        apiFetch<ServiceRow[]>(`/api/admin/services${branchQuery}`, {
          cache: "no-store",
        }),
        apiFetch<AttendanceRow[]>(`/api/admin/attendance${branchQuery}`, {
          cache: "no-store",
        }),
        apiFetch<MemberOption[]>(`/api/admin/members?status=Active${selectedBranchId ? `&branchId=${encodeURIComponent(selectedBranchId)}` : ""}`, {
          cache: "no-store",
        }),
      ]);

      setServices(servicePayload);
      setAttendance(attendancePayload);
      setMembers(membersPayload);
    } catch (err) {
      setServices([]);
      setAttendance([]);
      setMembers([]);
      setError(getErrorMessage(err, "Unable to load services and attendance."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeServiceId && !services.some((service) => service.id === activeServiceId)) {
      setActiveServiceId(null);
    }
  }, [activeServiceId, services]);

  const attendanceByService = useMemo(() => {
    const map = new Map<string, AttendanceRow[]>();
    attendance.forEach((entry) => {
      const list = map.get(entry.serviceId) ?? [];
      list.push(entry);
      map.set(entry.serviceId, list);
    });
    return map;
  }, [attendance]);

  const totalCheckIns = attendance.length;
  const todayCheckIns = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return attendance.filter((entry) => {
      const time = new Date(entry.createdAt).getTime();
      return time >= start && time < end;
    }).length;
  }, [attendance]);
  const averageAttendance = services.length > 0 ? Math.round(totalCheckIns / services.length) : 0;
  const filteredServices = useMemo(() => {
    const now = Date.now();
    return [...services]
      .filter((service) => {
        if (dateFilter === "upcoming" && new Date(service.date).getTime() < now) return false;
        if (dateFilter === "past" && new Date(service.date).getTime() >= now) return false;
        return true;
      })
      .filter((service) => {
        const query = serviceSearch.trim().toLowerCase();
        if (!query) return true;
        return service.name.toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [dateFilter, serviceSearch, services]);
  const nextService = useMemo(
    () => [...services].filter((service) => new Date(service.date).getTime() >= Date.now()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0],
    [services],
  );
  const activeService = services.find((service) => service.id === activeServiceId) ?? null;
  const activeServiceAttendance = useMemo(
    () => (activeService ? attendanceByService.get(activeService.id) ?? [] : []),
    [activeService, attendanceByService],
  );
  const recentAttendance = useMemo(
    () => [...activeServiceAttendance].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [activeServiceAttendance],
  );

  const createService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newServiceName.trim()) {
      setError("Service name is required.");
      return;
    }

    setCreatingService(true);
    setError("");
    setNotice("");

    try {
      await apiFetch<ServiceRow>("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newServiceName.trim(),
          date: new Date(newServiceDate).toISOString(),
          branchId: selectedBranchId,
        }),
      });
      setNotice("Service scheduled successfully.");
      setNewServiceName("");
      setNewServiceDate(toInputDateTime(new Date().toISOString()));
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to schedule service."));
    } finally {
      setCreatingService(false);
    }
  };

  const submitAttendance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeService) {
      setError("Pick a service first.");
      return;
    }

    if (checkInMode === "member" && !selectedMemberId) {
      setError("Select a member to check in.");
      return;
    }

    if (checkInMode === "visitor" && !visitorId.trim()) {
      setError("Enter a visitor identifier.");
      return;
    }

    setSubmittingAttendance(true);
    setError("");
    setNotice("");

    try {
      await apiFetch<AttendanceRow>("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: activeService.id,
          memberId: checkInMode === "member" ? selectedMemberId : undefined,
          visitorId: checkInMode === "visitor" ? visitorId.trim() : undefined,
          method: checkInMethod,
          branchId: selectedBranchId ?? activeService.branchId ?? undefined,
        }),
      });
      setNotice("Attendance recorded successfully.");
      setSelectedMemberId("");
      setVisitorId("");
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to record attendance."));
    } finally {
      setSubmittingAttendance(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Services Operations</p>
        <h2 className="mt-2 text-2xl font-black">Plan services, run check-in, and monitor attendance live.</h2>
        <p className="mt-2 max-w-2xl text-sm text-indigo-100">
          Use one structured workflow for scheduling, branch-aware check-ins, and attendance history.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => document.getElementById("schedule_service_form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-lg bg-white px-4 py-2 text-xs font-black uppercase tracking-wider !text-indigo-900 transition hover:bg-indigo-100"
          >
            Schedule Service
          </button>
          <button
            type="button"
            onClick={() => document.getElementById("attendance_checkin_form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-lg border border-indigo-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-indigo-100 transition hover:bg-indigo-700/40"
          >
            Open Check-In
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scheduled Services</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{services.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Check-Ins</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{totalCheckIns}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Attendance</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{averageAttendance}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today Check-Ins</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{todayCheckIns}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">Next service: {nextService ? formatDateTime(nextService.date) : "Not scheduled"}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-900">Services & Attendance</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Manage service schedule and capture member/visitor check-ins.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              value={serviceSearch}
              onChange={(event) => setServiceSearch(event.target.value)}
              placeholder="Search services"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as "all" | "upcoming" | "past")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setServiceSearch("");
                setDateFilter("all");
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Clear
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Attendance</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td className="px-4 py-4"><div className="h-4 w-36 animate-pulse rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-28 animate-pulse rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-200" /></td>
                    </tr>
                  ))
                ) : filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-medium text-slate-500">
                      No services match your current filter.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((service) => {
                    const count = attendanceByService.get(service.id)?.length ?? 0;
                    const isActive = activeServiceId === service.id;
                    return (
                      <tr key={service.id} className={isActive ? "bg-indigo-50/50" : ""}>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">{service.name}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{formatDateTime(service.date)}</td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">{count} check-ins</span>
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-semibold">
                          <button type="button" onClick={() => setActiveServiceId(service.id)} className="text-indigo-600 transition hover:text-indigo-500">
                            {isActive ? "Viewing" : "Check In"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <form id="schedule_service_form" onSubmit={createService} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Schedule Service</h3>
            <div className="mt-3 space-y-3">
              <input
                value={newServiceName}
                onChange={(event) => setNewServiceName(event.target.value)}
                placeholder="Service name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                required
              />
              <input
                type="datetime-local"
                value={newServiceDate}
                onChange={(event) => setNewServiceDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                required
              />
              <button
                type="submit"
                disabled={creatingService}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black uppercase tracking-wide !text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingService ? "Scheduling..." : "Schedule Service"}
              </button>
            </div>
          </form>

          <form id="attendance_checkin_form" onSubmit={submitAttendance} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Attendance Check-In</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {activeService ? `Selected: ${activeService.name} (${formatDateTime(activeService.date)})` : "Select a service from the table to start check-in."}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => setCheckInMode("member")}
                className={`rounded-md px-3 py-2 text-xs font-black uppercase tracking-wide transition ${checkInMode === "member" ? "bg-indigo-600 !text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Member
              </button>
              <button
                type="button"
                onClick={() => setCheckInMode("visitor")}
                className={`rounded-md px-3 py-2 text-xs font-black uppercase tracking-wide transition ${checkInMode === "visitor" ? "bg-indigo-600 !text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Visitor
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {checkInMode === "member" ? (
                <select
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Select member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={visitorId}
                  onChange={(event) => setVisitorId(event.target.value)}
                  placeholder="Visitor name or ID"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              )}

              <select
                value={checkInMethod}
                onChange={(event) => setCheckInMethod(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="manual">Manual desk</option>
                <option value="kiosk">Kiosk</option>
                <option value="qr">QR scan</option>
              </select>

              <button
                type="submit"
                disabled={submittingAttendance || !activeService}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black uppercase tracking-wide !text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingAttendance ? "Submitting..." : "Record Check-In"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}

      {activeService && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Live Attendance Feed</h3>
            <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              {activeServiceAttendance.length} check-ins
            </span>
          </div>
          {recentAttendance.length === 0 ? (
            <p className="text-sm text-slate-500">No attendance records yet for this service.</p>
          ) : (
            <ul className="space-y-2">
              {recentAttendance.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-800">
                    {entry.member ? `${entry.member.firstName} ${entry.member.lastName}` : entry.visitorId || "Visitor"}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {entry.method} · {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
