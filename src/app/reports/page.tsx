"use client";

import RequireGroup from "@/components/RequireGroup";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

/** Function URL for your Lambda (public read + staff delete) */
const FN_URL =
  "https://s47e7p42x7j5qgbuj2vkqcg5qe0blhxt.lambda-url.ap-south-1.on.aws/";

/* Types matching Lambda public responses */
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

type DetailRow = {
  patientId: string;
  testCode: string;
  value: string;
  unit: string;
  collectedAt: string;
  uploadId: string;
  sourceKey: string;
  SK: string;
};

type DetailResponse = {
  clinicId: string;
  uploadId: string;
  rows: DetailRow[];
  nextStartKey?: string;
  usedPrefix?: string;
};

async function readJsonSafe(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as unknown;
}
function isErrorResponse(x: unknown): x is ErrorResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    "ok" in x &&
    (x as { ok?: unknown }).ok === false
  );
}
function isListResponse(x: unknown): x is ListResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    Array.isArray((x as { items?: unknown }).items)
  );
}
function isDetailResponse(x: unknown): x is DetailResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    Array.isArray((x as { rows?: unknown }).rows)
  );
}

export default function HealthcarePage() {
  const [msg, setMsg] = useState<string>("");
  const [items, setItems] = useState<UploadMeta[]>([]);
  const [nextKey, setNextKey] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Detail state
  const [selected, setSelected] = useState<{
    clinicId: string;
    uploadId: string;
    filename: string;
  } | null>(null);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [detailNextKey, setDetailNextKey] = useState<string | undefined>(
    undefined
  );
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [filterClinic, setFilterClinic] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchAll = useCallback(
    async (append = false, startKey?: string): Promise<void> => {
      try {
        setLoading(true);
        setMsg("");

        const url = new URL(FN_URL);
        url.searchParams.set("public", "all");
        url.searchParams.set("limit", "20");
        if (startKey) url.searchParams.set("startKey", startKey);

        const res = await fetch(url.toString(), { method: "GET" });
        const data = await readJsonSafe(res);

        if (!res.ok) {
          if (isErrorResponse(data))
            throw new Error(data.message ?? data.error);
          throw new Error(`Request failed (${res.status})`);
        }
        if (!isListResponse(data)) throw new Error("Unexpected payload");

        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setNextKey(data.nextStartKey);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setMsg(`Load failed: ${message}`);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchDetail = useCallback(
    async (
      clinicId: string,
      uploadId: string,
      append = false,
      startKey?: string
    ): Promise<void> => {
      try {
        setDetailLoading(true);
        setMsg("");

        const url = new URL(FN_URL);
        url.searchParams.set("public", "detail");
        url.searchParams.set("clinicId", clinicId);
        url.searchParams.set("uploadId", uploadId);
        url.searchParams.set("limit", "100");
        if (startKey) url.searchParams.set("startKey", startKey);

        const res = await fetch(url.toString(), { method: "GET" });
        const data = await readJsonSafe(res);

        if (!res.ok) {
          if (isErrorResponse(data))
            throw new Error(data.message ?? data.error);
          throw new Error(`Request failed (${res.status})`);
        }
        if (!isDetailResponse(data)) throw new Error("Unexpected payload");

        setDetailRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
        setDetailNextKey(data.nextStartKey);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setMsg(`Detail load failed: ${message}`);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

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
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken) {
          setMsg("You must be signed in (HealthcareTeam/Admin) to delete.");
          return;
        }

        setMsg("Deleting…");
        const url = new URL(FN_URL);
        url.searchParams.set("action", "upload");
        url.searchParams.set("uploadId", uploadId);
        url.searchParams.set("clinicId", clinicId);

        const res = await fetch(url.toString(), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        });

        const data = await readJsonSafe(res);

        if (!res.ok) {
          if (isErrorResponse(data))
            throw new Error(data.message ?? data.error);
          throw new Error(`Delete failed (${res.status})`);
        }

        setItems((prev) => prev.filter((i) => i.uploadId !== uploadId));
        if (selected?.uploadId === uploadId) {
          setSelected(null);
          setDetailRows([]);
          setDetailNextKey(undefined);
        }
        setMsg(`Deleted upload #${uploadId}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setMsg(`Delete failed: ${message}`);
      } finally {
        setDeletingId(null);
      }
    },
    [selected]
  );

  useEffect(() => {
    void fetchAll(false);
  }, [fetchAll]);

  const total = useMemo(
    () => items.reduce((acc, it) => acc + (it.rowCount || 0), 0),
    [items]
  );

  // Apply filters
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

  return (
    <RequireGroup allow={["HealthcareTeam"]}>
      <main className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center py-8">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-7xl">
          <h1 className="text-3xl font-bold mb-1 text-center">
            Healthcare Team – All Uploads
          </h1>
          <p className="text-center text-sm text-gray-400">
            Public read from DynamoDB (ALL uploads). Showing {items.length}{" "}
            uploads, total rows ~{total}.
          </p>
          {msg && <p className="mt-3 text-sm text-amber-300">{msg}</p>}
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
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-300">
                  <th className="p-2">Clinic</th>
                  <th className="p-2">File</th>
                  <th className="p-2">Uploaded</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Rows</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td className="p-2 text-gray-400" colSpan={6}>
                      No matching uploads.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((it) => (
                    <tr key={it.SK} className="border-t border-gray-700">
                      <td className="p-2">{it.clinicId}</td>
                      <td className="p-2">{it.filename}</td>
                      <td className="p-2">
                        {new Date(it.uploadedAt).toLocaleString()}
                      </td>
                      <td className="p-2">{it.status}</td>
                      <td className="p-2 text-right">{it.rowCount}</td>
                      <td className="p-2 text-right flex gap-2 justify-end">
                        <button
                          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => {
                            setSelected({
                              clinicId: it.clinicId,
                              uploadId: it.uploadId,
                              filename: it.filename,
                            });
                            setDetailRows([]);
                            setDetailNextKey(undefined);
                            void fetchDetail(it.clinicId, it.uploadId, false);
                          }}
                        >
                          View
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
                          title="Requires HealthcareTeam/Admin sign-in"
                        >
                          {deletingId === it.uploadId ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Detail panel */}
          {selected && (
            <div className="mt-8 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-700 rounded-t-lg">
                <h2 className="text-lg font-semibold">
                  {selected.filename} · {selected.clinicId} · #
                  {selected.uploadId}
                </h2>
                <div className="flex gap-2">
                  {detailNextKey && (
                    <button
                      className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                      onClick={() =>
                        void fetchDetail(
                          selected.clinicId,
                          selected.uploadId,
                          true,
                          detailNextKey
                        )
                      }
                      disabled={detailLoading}
                    >
                      {detailLoading ? "Loading…" : "Load more rows"}
                    </button>
                  )}
                  <button
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                    onClick={() => setSelected(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-300">
                      <th className="p-2">Patient ID</th>
                      <th className="p-2">Test Code</th>
                      <th className="p-2">Value</th>
                      <th className="p-2">Unit</th>
                      <th className="p-2">Collected At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.length === 0 ? (
                      <tr>
                        <td className="p-2 text-gray-400" colSpan={5}>
                          {detailLoading ? "Loading rows…" : "No rows"}
                        </td>
                      </tr>
                    ) : (
                      detailRows.map((r) => (
                        <tr key={r.SK} className="border-t border-gray-700">
                          <td className="p-2">{r.patientId}</td>
                          <td className="p-2">{r.testCode}</td>
                          <td className="p-2">{r.value}</td>
                          <td className="p-2">{r.unit}</td>
                          <td className="p-2">{r.collectedAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </RequireGroup>
  );
}
