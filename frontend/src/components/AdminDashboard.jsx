import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { formatDistanceToNow, format, subDays, eachDayOfInterval } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const API = "/api";
const CHART_COLORS = ["#1d9bf0", "#6366f1", "#ec4899", "#4ade80", "#f59e0b", "#eab308", "#94a3b8"];

function useAdminAxios(token) {
  return useMemo(() => {
    const client = axios.create({ baseURL: API });
    client.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return client;
  }, [token]);
}

function badgeStyle(color, bg) {
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'DM Mono', monospace",
    color,
    background: bg,
    border: `1px solid ${color}55`,
  };
}

function aggregateReports(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.contentType}:${r.contentId}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        contentType: r.contentType,
        contentId: r.contentId,
        contentPreview: r.contentPreview || (r.contentText || "").slice(0, 50),
        contentText: r.contentText || "",
        authorUsername: r.authorUsername || "",
        authorDisplayName: r.authorDisplayName || "",
        reports: [],
      });
    }
    map.get(key).reports.push(r);
  }
  return [...map.values()].map((g) => {
    const reasons = {};
    for (const r of g.reports) {
      reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    }
    const topReason =
      Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const sorted = [...g.reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const hasPending = g.reports.some((x) => x.status === "pending");
    const displayStatus = hasPending ? "pending" : sorted[0]?.status || "pending";
    const latest = sorted[0]?.createdAt;
    return {
      ...g,
      reporterCount: g.reports.length,
      topReason,
      displayStatus,
      latestCreated: latest,
    };
  });
}

export default function AdminDashboard({ token, user, onNavigate, onUserRefresh }) {
  const client = useAdminAxios(token);
  const [allowed, setAllowed] = useState(null);
  const [tab, setTab] = useState("reports");
  const [toast, setToast] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const showToast = (message, isError) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 5000);
  };

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await client.get("/users/me");
      if (data?.role === "admin") {
        setAllowed(true);
        onUserRefresh?.(data);
      } else {
        setAllowed(false);
      }
    } catch {
      setAllowed(false);
      showToast("Could not verify admin access", true);
    }
  }, [token, client, onUserRefresh]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user?.role === "admin") setAllowed(true);
  }, [user?.role]);

  const touchRefresh = () => setLastRefresh(new Date());

  if (allowed === false) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#e7edf3", fontFamily: "'Sora', sans-serif" }}>
        <h2 style={{ marginBottom: 12 }}>Access denied</h2>
        <p style={{ color: "#4a5568" }}>Admin dashboard is only available to admin accounts.</p>
      </div>
    );
  }

  if (allowed === null && user?.role !== "admin") {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
        Verifying admin access…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 60px)", background: "#060b14" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 2000,
            padding: "12px 18px",
            borderRadius: 12,
            background: toast.isError ? "#7f1d1d" : "#0f4f7a",
            color: "#fff",
            fontSize: 14,
            fontFamily: "'Sora', sans-serif",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            maxWidth: 360,
          }}
        >
          {toast.message}
        </div>
      )}

      <aside
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: "1px solid #1e2733",
          padding: "16px 12px",
          background: "#0a0f1a",
        }}
      >
        <div style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace", marginBottom: 12, letterSpacing: "0.08em" }}>
          ADMIN
        </div>
        {[
          { id: "reports", label: "Reports" },
          { id: "logs", label: "Moderation Logs" },
          { id: "stats", label: "Stats" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              marginBottom: 4,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "'Sora', sans-serif",
              fontSize: 14,
              fontWeight: tab === t.id ? 700 : 500,
              background: tab === t.id ? "rgba(29,155,240,0.15)" : "transparent",
              color: tab === t.id ? "#1d9bf0" : "#c9d6e3",
            }}
          >
            {t.label}
          </button>
        ))}
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            padding: "12px 20px",
            borderBottom: "1px solid #1e2733",
            background: "rgba(6,11,20,0.92)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#4a5568" }}>
            Last refresh:{" "}
            <span style={{ color: "#e7edf3" }}>{format(lastRefresh, "HH:mm:ss")}</span>{" "}
            <span style={{ opacity: 0.7 }}>({formatDistanceToNow(lastRefresh, { addSuffix: true })})</span>
          </div>
          <button
            type="button"
            onClick={() => {
              touchRefresh();
              window.dispatchEvent(new CustomEvent("admin-dashboard-refresh"));
            }}
            style={{
              background: "#1d9bf0",
              color: "#fff",
              border: "none",
              borderRadius: 9999,
              padding: "8px 16px",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "'Sora', sans-serif",
            }}
          >
            Refresh
          </button>
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {tab === "reports" && (
            <ReportsTab
              client={client}
              onNavigate={onNavigate}
              showToast={showToast}
              touchRefresh={touchRefresh}
            />
          )}
          {tab === "logs" && <ModerationLogsTab client={client} showToast={showToast} touchRefresh={touchRefresh} />}
          {tab === "stats" && <StatsTab client={client} showToast={showToast} touchRefresh={touchRefresh} />}
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ client, onNavigate, showToast, touchRefresh }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchReports = useCallback(async () => {
    setLoading(true);
    touchRefresh();
    try {
      const params = { limit: pageSize, offset: page * pageSize };
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate + "T23:59:59.999Z").toISOString();
      const { data } = await client.get("/admin/reports", { params });
      setItems(data.items || []);
      setTotal(data.total ?? (data.items || []).length);
    } catch (e) {
      showToast(e.response?.data?.message || e.message || "Failed to load reports", true);
    } finally {
      setLoading(false);
    }
  }, [client, statusFilter, startDate, endDate, page, showToast, touchRefresh]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const h = () => fetchReports();
    window.addEventListener("admin-dashboard-refresh", h);
    return () => window.removeEventListener("admin-dashboard-refresh", h);
  }, [fetchReports]);

  const statusBadge = (s) => {
    if (s === "pending") return badgeStyle("#f59e0b", "rgba(245,158,11,0.12)");
    if (s === "approved") return badgeStyle("#4ade80", "rgba(74,222,128,0.12)");
    return badgeStyle("#f87171", "rgba(248,113,113,0.12)");
  };

  const patchReport = async (id, status) => {
    try {
      await client.patch(`/admin/reports/${id}`, { status });
      showToast(`Report #${id} ${status}`);
      fetchReports();
    } catch (e) {
      showToast(e.response?.data?.message || e.message, true);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, color: "#e7edf3", fontFamily: "'Sora', sans-serif", fontWeight: 800 }}>Reports</h2>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <select
          value={statusFilter}
          onChange={(e) => { setPage(0); setStatusFilter(e.target.value); }}
          style={filterInputStyle}
        >
          <option value="">All statuses</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => { setPage(0); setStartDate(e.target.value); }} style={filterInputStyle} />
        <span style={{ color: "#4a5568" }}>→</span>
        <input type="date" value={endDate} onChange={(e) => { setPage(0); setEndDate(e.target.value); }} style={filterInputStyle} />
      </div>

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #1e2733", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "'Sora', sans-serif" }}>
            <thead>
              <tr style={{ background: "#0d1117", color: "#94a3b8", textAlign: "left" }}>
                <th style={th}>ID</th>
                <th style={th}>Content type</th>
                <th style={th}>Reason</th>
                <th style={th}>Status</th>
                <th style={th}>Author</th>
                <th style={th}>Created date</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid #1e2733", color: "#c9d6e3" }}>
                  <td style={td}>{item.id}</td>
                  <td style={td}>{item.contentType}</td>
                  <td style={td}>{item.reason}</td>
                  <td style={td}>{statusBadge(item.status)}</td>
                  <td style={td}>
                    {item.user?.username ? (
                      <button
                        type="button"
                        onClick={() => onNavigate("profile", item.user.username)}
                        style={{ background: "none", border: "none", color: "#1d9bf0", cursor: "pointer", padding: 0 }}
                      >
                        @{item.user.username}
                      </button>
                    ) : (
                      item.userId || "—"
                    )}
                  </td>
                  <td style={td}>{format(new Date(item.createdAt), "MMM d, yyyy HH:mm")}</td>
                  <td style={td}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button type="button" onClick={() => patchReport(item.id, "approved")} style={btnPrimary}>Approve</button>
                      <button type="button" onClick={() => patchReport(item.id, "rejected")} style={btnDanger}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, alignItems: "center", color: "#4a5568", fontSize: 13 }}>
          <span>Page {page + 1} / {totalPages} · {total} reports</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(p - 1, 0))} style={btnMuted}>Prev</button>
            <button type="button" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)} style={btnMuted}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModerationLogsTab({ client, showToast, touchRefresh }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [decision, setDecision] = useState("");
  const [method, setMethod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expanded, setExpanded] = useState(null);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    touchRefresh();
    try {
      const params = { limit, offset: page * limit };
      if (decision) params.decision = decision;
      if (method) params.method = method;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate + "T23:59:59.999Z").toISOString();
      const { data } = await client.get("/admin/moderation-logs", { params });
      setItems(data.items || []);
      setTotal(data.total ?? 0);
    } catch (e) {
      showToast(e.response?.data?.message || e.message, true);
    } finally {
      setLoading(false);
    }
  }, [client, page, decision, method, startDate, endDate, showToast, touchRefresh]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const h = () => fetchLogs();
    window.addEventListener("admin-dashboard-refresh", h);
    return () => window.removeEventListener("admin-dashboard-refresh", h);
  }, [fetchLogs]);

  const exportCsv = () => {
    const rows = [
      ["id", "contentType", "contentId", "decision", "detectionMethod", "reason", "confidence", "createdAt"].join(","),
      ...items.map((l) =>
        [l.id, l.contentType, l.contentId, l.decision, l.detectionMethod, JSON.stringify(l.reason || ""), l.confidence ?? "", l.createdAt].join(","),
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moderation-logs-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded");
  };

  const decisionBadge = (d) =>
    d === "approved" ? badgeStyle("#4ade80", "rgba(74,222,128,0.12)") : badgeStyle("#f87171", "rgba(248,113,113,0.12)");

  const methodBadge = (m) => badgeStyle("#94a3b8", "rgba(148,163,184,0.12)");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, color: "#e7edf3", fontFamily: "'Sora', sans-serif", fontWeight: 800 }}>Moderation logs</h2>
        <button type="button" onClick={exportCsv} style={btnPrimary}>
          Export CSV
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <select value={decision} onChange={(e) => { setPage(0); setDecision(e.target.value); }} style={filterInputStyle}>
          <option value="">All decisions</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <select value={method} onChange={(e) => { setPage(0); setMethod(e.target.value); }} style={filterInputStyle}>
          <option value="">All methods</option>
          <option value="google_vision">google_vision</option>
          <option value="openai_moderation">openai_moderation</option>
          <option value="banned_terms_fallback">banned_terms_fallback</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => { setPage(0); setStartDate(e.target.value); }} style={filterInputStyle} />
        <input type="date" value={endDate} onChange={(e) => { setPage(0); setEndDate(e.target.value); }} style={filterInputStyle} />
      </div>

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #1e2733", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "'Sora', sans-serif" }}>
            <thead>
              <tr style={{ background: "#0d1117", color: "#94a3b8", textAlign: "left" }}>
                <th style={th}>Content type</th>
                <th style={th}>Decision</th>
                <th style={th}>Detection method</th>
                <th style={th}>Reason</th>
                <th style={th}>Confidence</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <React.Fragment key={l.id}>
                  <tr
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                    style={{ borderTop: "1px solid #1e2733", cursor: "pointer", color: "#c9d6e3" }}
                  >
                    <td style={td}>{l.contentType}</td>
                    <td style={td}>{decisionBadge(l.decision)}</td>
                    <td style={td}>{methodBadge(l.detectionMethod)}</td>
                    <td style={td}>{l.decision === "approved" ? "Passed" : l.reason}</td>
                    <td style={td}>{l.confidence != null ? `${Math.round(l.confidence * 100)}%` : "—"}</td>
                    <td style={td}>{format(new Date(l.createdAt), "MMM d, HH:mm")}</td>
                  </tr>
                  {expanded === l.id && (
                    <tr>
                      <td colSpan={6} style={{ ...td, background: "rgba(0,0,0,0.25)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        <details open>
                          <summary style={{ cursor: "pointer", color: "#1d9bf0", marginBottom: 8 }}>raw API response (JSON)</summary>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#94a3b8", maxHeight: 320, overflow: "auto" }}>
                            {JSON.stringify(l.rawResult ?? {}, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, color: "#4a5568", fontSize: 13 }}>
          <span>
            Showing {items.length} of {total}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} style={btnMuted}>
              Prev
            </button>
            <button type="button" disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)} style={btnMuted}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsTab({ client, showToast, touchRefresh }) {
  const [loading, setLoading] = useState(true);
  const [reportStats, setReportStats] = useState(null);
  const [modStats, setModStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [charts, setCharts] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    touchRefresh();
    try {
      const [rs, ms, tr, ch] = await Promise.all([
        client.get("/admin/reports/stats"),
        client.get("/admin/moderation-logs/stats"),
        client.get("/admin/reports/trends", { params: { days: 30 } }),
        client.get("/admin/moderation-logs/charts"),
      ]);
      setReportStats(rs.data);
      setModStats(ms.data);
      setTrends(tr.data || []);
      setCharts(ch.data);
    } catch (e) {
      showToast(e.response?.data?.message || e.message, true);
    } finally {
      setLoading(false);
    }
  }, [client, showToast, touchRefresh]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const h = () => load();
    window.addEventListener("admin-dashboard-refresh", h);
    return () => window.removeEventListener("admin-dashboard-refresh", h);
  }, [load]);

  const lineData = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 29);
    const days = eachDayOfInterval({ start, end });
    const map = new Map((trends || []).map((t) => [t.date, t.count]));
    return days.map((d) => ({
      date: format(d, "MM/dd"),
      count: map.get(format(d, "yyyy-MM-dd")) ?? 0,
    }));
  }, [trends]);

  const reasonPie = (charts?.rejectionReasons || []).slice(0, 8).map((r) => ({ name: r.reason.slice(0, 40), value: r.count }));
  const methodPie = modStats?.byMethod
    ? Object.entries(modStats.byMethod).map(([name, value]) => ({ name, value }))
    : [];

  if (loading) return <Loading />;

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", color: "#e7edf3", fontFamily: "'Sora', sans-serif", fontWeight: 800 }}>Overview</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total reports" value={reportStats?.total ?? 0} />
        <StatCard label="Pending reports" value={reportStats?.pending ?? 0} color="#f59e0b" />
        <StatCard label="Approved reports" value={reportStats?.approved ?? 0} color="#4ade80" />
        <StatCard label="Rejected reports" value={reportStats?.rejected ?? 0} color="#f87171" />
        <StatCard label="Moderation logs" value={modStats?.total ?? 0} color="#1d9bf0" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        <div style={chartBox}>
          <h3 style={chartTitle}>Reports (30 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2733", borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#1d9bf0" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={chartBox}>
          <h3 style={chartTitle}>Rejection reasons (logs)</h3>
          {reasonPie.length === 0 ? (
            <div style={{ color: "#4a5568", padding: 24 }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={reasonPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {reasonPie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2733" }} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={chartBox}>
          <h3 style={chartTitle}>Detection methods (logs)</h3>
          {methodPie.length === 0 ? (
            <div style={{ color: "#4a5568", padding: 24 }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={methodPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {methodPie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2733" }} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ ...chartBox, marginTop: 20 }}>
        <h3 style={chartTitle}>Approval rate by detection method</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "#64748b", textAlign: "left" }}>
              <th style={th}>Method</th>
              <th style={th}>Approved</th>
              <th style={th}>Rejected</th>
              <th style={th}>Approval %</th>
            </tr>
          </thead>
          <tbody>
            {(charts?.methodApprovalRates || []).map((row) => (
              <tr key={row.method} style={{ borderTop: "1px solid #1e2733", color: "#c9d6e3" }}>
                <td style={td}>{row.method}</td>
                <td style={td}>{row.approved}</td>
                <td style={td}>{row.rejected}</td>
                <td style={td}>{row.approvalRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!charts?.methodApprovalRates || charts.methodApprovalRates.length === 0) && (
          <div style={{ color: "#4a5568", padding: 16 }}>No moderation data yet.</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "#e7edf3" }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #1e2733", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'Sora', sans-serif" }}>{value}</div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ padding: 48, textAlign: "center", color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
      Loading…
    </div>
  );
}

function Empty() {
  return (
    <div style={{ padding: 48, textAlign: "center", color: "#4a5568", fontFamily: "'Sora', sans-serif" }}>
      No data
    </div>
  );
}

const th = { padding: "10px 12px", fontFamily: "'DM Mono', monospace", fontSize: 11 };
const td = { padding: "10px 12px", verticalAlign: "top" };
const filterInputStyle = {
  background: "#0d1117",
  border: "1px solid #1e2733",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#e7edf3",
  fontSize: 13,
  fontFamily: "'Sora', sans-serif",
};
const btnPrimary = {
  background: "#1d9bf0",
  color: "#fff",
  border: "none",
  borderRadius: 9999,
  padding: "8px 14px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "'Sora', sans-serif",
};
const btnDanger = {
  background: "#7f1d1d",
  color: "#fff",
  border: "none",
  borderRadius: 9999,
  padding: "8px 14px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "'Sora', sans-serif",
};
const btnMuted = {
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #1e2733",
  borderRadius: 9999,
  padding: "8px 14px",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "'Sora', sans-serif",
};
const chartBox = { background: "#0d1117", border: "1px solid #1e2733", borderRadius: 12, padding: 16 };
const chartTitle = { margin: "0 0 12px", color: "#e7edf3", fontSize: 15, fontWeight: 700, fontFamily: "'Sora', sans-serif" };
