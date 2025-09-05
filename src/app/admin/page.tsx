"use client";

import RequireGroup from "@/components/RequireGroup";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

/** Function URL for your Lambda */
const FN_URL =
  "https://s47e7p42x7j5qgbuj2vkqcg5qe0blhxt.lambda-url.ap-south-1.on.aws/";

/* === Types matching Lambda responses === */
type UploadMeta = {
  PK: string;
  SK: string;
  clinicId: string;
  uploadId: string;
  filename: string;
  s3Key: string;
  uploadedAt: string;
  status: string;
  rowCount: number;
  uploadedByEmail?: string;
  uploadedBySub?: string;
  uploadedByUsername?: string;
};

type ListResponse = { items: UploadMeta[]; nextStartKey?: string };
type ErrorResponse = { ok: false; error: string; message?: string };
type DeleteOk = { ok: true; uploadId: string; clinicId: string };
type AuthDiag = {
  stage: "auth";
  clinicId: string;
  sub: string;
  email?: string;
  username?: string;
  userIsStaff?: boolean;
};
type PokeDiag = {
  stage: "poke";
  method?: string;
  bodyBytes?: number;
  hasAuth?: boolean;
};

function isErrorResponse(x: unknown): x is ErrorResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    "ok" in x &&
    (x as { ok?: unknown }).ok === false
  );
}

async function readJsonSafe<T>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Completed: "bg-emerald-600/30 text-emerald-300 border-emerald-600",
    Pending: "bg-yellow-600/30 text-yellow-300 border-yellow-600",
    Failed: "bg-rose-600/30 text-rose-300 border-rose-600",
  };
  return (
    <span
      className={classNames(
        "px-2 py-1 rounded text-xs border",
        colors[status] || "bg-slate-700/30 text-slate-300 border-slate-700"
      )}
    >
      {status}
    </span>
  );
}

export default function AdminPage() {
  const [msg, setMsg] = useState<string>("");

  // Diagnostics
  const [poke, setPoke] = useState<PokeDiag | null>(null);
  const [auth, setAuth] = useState<AuthDiag | null>(null);

  // All uploads (across clinics)
  const [items, setItems] = useState<UploadMeta[]>([]);
  const [nextKey, setNextKey] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit-inline state
  const [editId, setEditId] = useState<string | null>(null);
  const [editClinic, setEditClinic] = useState<string>("");
  const [editFilename, setEditFilename] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [filterClinic, setFilterClinic] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // === Derived statistics ===
  const totalRows = useMemo(
    () => items.reduce((acc, it) => acc + (it.rowCount || 0), 0),
    [items]
  );

  const numClinics = useMemo(() => {
    const set = new Set(items.map((i) => i.clinicId));
    return set.size;
  }, [items]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of items) {
      counts[i.status] = (counts[i.status] || 0) + 1;
    }
    return counts;
  }, [items]);

  const uploadsPerClinic = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) {
      map[i.clinicId] = (map[i.clinicId] || 0) + 1;
    }
    return Object.entries(map).map(([clinicId, count]) => ({
      clinicId,
      count,
    }));
  }, [items]);

  const uploadsOverTime = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) {
      const day = new Date(i.uploadedAt).toLocaleDateString();
      map[day] = (map[day] || 0) + 1;
    }
    return Object.entries(map)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch =
        search === "" ||
        it.filename.toLowerCase().includes(search.toLowerCase());

      const matchesClinic =
        filterClinic === "all" || it.clinicId === filterClinic;

      const matchesStatus =
        filterStatus === "all" || it.status === filterStatus;

      return matchesSearch && matchesClinic && matchesStatus;
    });
  }, [items, search, filterClinic, filterStatus]);

  // === Auth token ===
  const getIdToken = useCallback(async (): Promise<string> => {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? "";
  }, []);

  // === Diagnostics ===
  const runPoke = useCallback(async (): Promise<void> => {
    try {
      setMsg("Pinging…");
      const url = new URL(FN_URL);
      url.searchParams.set("mode", "poke");
      const res = await fetch(url.toString(), { method: "POST" });
      const data = await readJsonSafe<PokeDiag>(res);
      setPoke(data);
      setMsg("Poke OK");
    } catch (e) {
      setPoke(null);
      const m = e instanceof Error ? e.message : String(e);
      setMsg(`Poke failed: ${m}`);
    }
  }, []);

  const runAuthDiag = useCallback(async (): Promise<void> => {
    try {
      setMsg("Checking auth…");
      const idToken = await getIdToken();
      if (!idToken) throw new Error("Not signed in");
      const url = new URL(FN_URL);
      url.searchParams.set("mode", "auth");
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await readJsonSafe<AuthDiag>(res);
      setAuth(data);
      setMsg("Auth OK");
    } catch (e) {
      setAuth(null);
      const m = e instanceof Error ? e.message : String(e);
      setMsg(`Auth check failed: ${m}`);
    }
  }, [getIdToken]);

  // === Load all uploads ===
  const loadAll = useCallback(
    async (append = false, startKey?: string): Promise<void> => {
      try {
        setLoading(true);
        setMsg("");
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Not signed in");

        const url = new URL(FN_URL);
        url.searchParams.set("action", "list");
        url.searchParams.set("scope", "all");
        url.searchParams.set("limit", "20");
        if (startKey) url.searchParams.set("startKey", startKey);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await readJsonSafe<ListResponse | ErrorResponse>(res);

        if (!res.ok) {
          if (isErrorResponse(data))
            throw new Error(data.message ?? data.error);
          throw new Error(`List failed (${res.status})`);
        }
        const list = data as ListResponse;
        setItems((prev) => (append ? [...prev, ...list.items] : list.items));
        setNextKey(list.nextStartKey);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        setMsg(`Load failed: ${m}`);
      } finally {
        setLoading(false);
      }
    },
    [getIdToken]
  );

  // === Delete upload ===
  const deleteUpload = useCallback(
    async (clinicId: string, uploadId: string): Promise<void> => {
      try {
        if (
          !confirm(
            `Delete upload #${uploadId} from clinic ${clinicId}? This cannot be undone.`
          )
        )
          return;
        setDeletingId(uploadId);
        setMsg("Getting token…");
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Not signed in");

        setMsg("Deleting…");
        const url = new URL(FN_URL);
        url.searchParams.set("action", "upload");
        url.searchParams.set("uploadId", uploadId);
        url.searchParams.set("clinicId", clinicId);

        const res = await fetch(url.toString(), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await readJsonSafe<DeleteOk | ErrorResponse>(res);

        if (!res.ok) {
          if (isErrorResponse(data))
            throw new Error(data.message ?? data.error);
          throw new Error(`Delete failed (${res.status})`);
        }
        setItems((prev) => prev.filter((i) => i.uploadId !== uploadId));
        setMsg(`Deleted upload #${uploadId}`);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        setMsg(`Delete failed: ${m}`);
      } finally {
        setDeletingId(null);
      }
    },
    [getIdToken]
  );

  // === Edit upload ===
  const beginEdit = useCallback((u: UploadMeta): void => {
    setEditId(u.uploadId);
    setEditClinic(u.clinicId);
    setEditFilename(u.filename);
    setEditStatus(u.status);
  }, []);

  const saveEdit = useCallback(async (): Promise<void> => {
    try {
      if (!editId) return;
      setMsg("Saving…");
      const idToken = await getIdToken();
      if (!idToken) throw new Error("Not signed in");

      const url = new URL(FN_URL);
      url.searchParams.set("action", "meta");
      const body = {
        uploadId: editId,
        clinicId: editClinic,
        filename: editFilename,
        status: editStatus,
      };

      const res = await fetch(url.toString(), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await readJsonSafe<Record<string, unknown> | ErrorResponse>(
        res
      );
      if (!res.ok) {
        if (isErrorResponse(data)) throw new Error(data.message ?? data.error);
        throw new Error(`Update failed (${res.status})`);
      }

      setItems((prev) =>
        prev.map((it) =>
          it.uploadId === editId
            ? { ...it, filename: editFilename, status: editStatus }
            : it
        )
      );
      setMsg("Saved");
      setEditId(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg(`Save failed: ${m}`);
    }
  }, [editClinic, editFilename, editId, editStatus, getIdToken]);

  // Initial load
  useEffect(() => {
    void runPoke();
    void runAuthDiag();
    void loadAll(false);
  }, [runPoke, runAuthDiag, loadAll]);

  return (
    <RequireGroup allow={["Admin"]}>
      <main className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center py-8">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-7xl">
          <h1 className="text-3xl font-bold mb-2 text-center">
            Admin Dashboard
          </h1>

          {/* Status message */}
          {msg && <p className="mt-3 text-sm text-amber-300">{msg}</p>}

          {/* Diagnostics */}
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div className="border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Lambda · Poke</h2>
                <button
                  className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                  onClick={() => void runPoke()}
                >
                  Run
                </button>
              </div>
              <pre className="text-xs bg-gray-900 p-3 rounded overflow-x-auto">
                {poke ? JSON.stringify(poke, null, 2) : "—"}
              </pre>
            </div>

            <div className="border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Auth · Verify (Admin)</h2>
                <button
                  className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                  onClick={() => void runAuthDiag()}
                >
                  Run
                </button>
              </div>
              <pre className="text-xs bg-gray-900 p-3 rounded overflow-x-auto">
                {auth ? JSON.stringify(auth, null, 2) : "—"}
              </pre>
            </div>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-sm text-gray-300">Total Uploads</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{totalRows}</p>
              <p className="text-sm text-gray-300">Total Rows</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{numClinics}</p>
              <p className="text-sm text-gray-300">Clinics</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">
                {statusCounts["Completed"] ?? 0}
              </p>
              <p className="text-sm text-gray-300">Completed</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="bg-slate-800 p-4 rounded-lg">
              <h3 className="text-sm font-semibold mb-2">Uploads per Clinic</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={uploadsPerClinic}>
                  <XAxis dataKey="clinicId" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg">
              <h3 className="text-sm font-semibold mb-2">Uploads Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={uploadsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#34d399" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <input
              type="text"
              placeholder="Search by filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm w-full md:w-1/3"
            />
            <div className="flex gap-3">
              <select
                value={filterClinic}
                onChange={(e) => setFilterClinic(e.target.value)}
                className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm"
              >
                <option value="all">All Clinics</option>
                {[...new Set(items.map((i) => i.clinicId))].map((cid) => (
                  <option key={cid} value={cid}>
                    {cid}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm"
              >
                <option value="all">All Statuses</option>
                {[...new Set(items.map((i) => i.status))].map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Refresh + Load More */}
          <div className="mt-4 flex gap-2">
            <button
              className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
              onClick={() => void loadAll(false)}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh All Uploads"}
            </button>
            {nextKey && (
              <button
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                onClick={() => void loadAll(true, nextKey)}
                disabled={loading}
              >
                Load more
              </button>
            )}
          </div>

          {/* All uploads */}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-300 bg-slate-700/50">
                  <th className="p-2">Clinic</th>
                  <th className="p-2">File</th>
                  <th className="p-2">Uploaded</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Rows</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td className="p-2 text-gray-400" colSpan={6}>
                      No matching uploads found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((it) => {
                    const isEditing =
                      editId === it.uploadId && editClinic === it.clinicId;
                    return (
                      <tr key={it.SK} className="border-t border-gray-700">
                        <td className="p-2">{it.clinicId}</td>
                        <td className="p-2">
                          {isEditing ? (
                            <input
                              value={editFilename}
                              onChange={(e) => setEditFilename(e.target.value)}
                              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-56"
                            />
                          ) : (
                            it.filename
                          )}
                        </td>
                        <td className="p-2">
                          {new Date(it.uploadedAt).toLocaleString()}
                        </td>
                        <td className="p-2">
                          {isEditing ? (
                            <input
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-40"
                            />
                          ) : (
                            <StatusBadge status={it.status} />
                          )}
                        </td>
                        <td className="p-2 text-right">{it.rowCount}</td>
                        <td className="p-2">
                          <div className="flex gap-2 justify-end">
                            {isEditing ? (
                              <>
                                <button
                                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => void saveEdit()}
                                >
                                  Save
                                </button>
                                <button
                                  className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600"
                                  onClick={() => setEditId(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600"
                                  onClick={() => {
                                    setEditClinic(it.clinicId);
                                    beginEdit(it);
                                  }}
                                  title="Edit filename/status"
                                >
                                  Edit
                                </button>
                                <button
                                  className={`px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white ${
                                    deletingId === it.uploadId
                                      ? "opacity-60 cursor-not-allowed"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    void deleteUpload(it.clinicId, it.uploadId)
                                  }
                                  disabled={deletingId === it.uploadId}
                                  title="Delete upload and all parsed rows"
                                >
                                  {deletingId === it.uploadId
                                    ? "Deleting…"
                                    : "Delete"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </RequireGroup>
  );
}
