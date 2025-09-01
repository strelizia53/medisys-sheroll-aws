"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

// ---- CONFIG ----
const FN_URL =
  "https://s47e7p42x7j5qgbuj2vkqcg5qe0blhxt.lambda-url.ap-south-1.on.aws/";

// ---- TYPES ----
export type UploadMeta = {
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
  uploadId: string;
  rows: DetailRow[];
  nextStartKey?: string;
};
type ErrorResponse = { ok: false; error: string; message?: string };

// ---- HELPERS (no `any`) ----
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
  if (typeof x !== "object" || x === null) return false;
  const y = x as { items?: unknown };
  return Array.isArray(y.items);
}
function isDetailResponse(x: unknown): x is DetailResponse {
  if (typeof x !== "object" || x === null) return false;
  const y = x as { rows?: unknown; uploadId?: unknown };
  return typeof y.uploadId === "string" && Array.isArray(y.rows);
}

export default function UploadPage() {
  // UI state
  const [msg, setMsg] = useState<string>("");
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [items, setItems] = useState<UploadMeta[]>([]);
  const [nextKey, setNextKey] = useState<string | undefined>(undefined);

  // detail viewer
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [rowsNextKey, setRowsNextKey] = useState<string | undefined>(undefined);
  const [loadingRows, setLoadingRows] = useState<boolean>(false);

  const getIdToken = useCallback(async (): Promise<string> => {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? "";
  }, []);

  // ------- READ: list uploads from Lambda -------
  const fetchList = useCallback(
    async (append = false, startKey?: string): Promise<void> => {
      try {
        setLoadingList(true);
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Not signed in");

        const url = new URL(FN_URL);
        url.searchParams.set("action", "list");
        url.searchParams.set("limit", "20");
        if (startKey) url.searchParams.set("startKey", startKey);

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
        });

        const data = await readJsonSafe(res);
        if (!res.ok) {
          if (isErrorResponse(data))
            throw new Error(data.message ?? data.error);
          throw new Error(`Request failed (${res.status})`);
        }
        if (!isListResponse(data)) throw new Error("Unexpected list payload");

        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setNextKey(data.nextStartKey);
        setMsg("");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setMsg(`Load failed: ${message}`);
      } finally {
        setLoadingList(false);
      }
    },
    [getIdToken]
  );

  // ------- READ: detail rows for one upload -------
  const fetchDetail = useCallback(
    async (
      uploadId: string,
      startKey?: string,
      append = false
    ): Promise<void> => {
      try {
        setLoadingRows(true);
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Not signed in");

        const url = new URL(FN_URL);
        url.searchParams.set("action", "detail");
        url.searchParams.set("uploadId", uploadId);
        url.searchParams.set("limit", "100");
        if (startKey) url.searchParams.set("startKey", startKey);

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
        });

        const data = await readJsonSafe(res);
        if (!res.ok) {
          if (isErrorResponse(data))
            throw new Error(data.message ?? data.error);
          throw new Error(`Request failed (${res.status})`);
        }
        if (!isDetailResponse(data))
          throw new Error("Unexpected detail payload");

        setRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
        setRowsNextKey(data.nextStartKey);
        setMsg("");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setMsg(`Load rows failed: ${message}`);
      } finally {
        setLoadingRows(false);
      }
    },
    [getIdToken]
  );

  // initial load
  useEffect(() => {
    void fetchList(false);
  }, [fetchList]);

  // ------- WRITE: upload file to Lambda -------
  const upload = useCallback(
    async (file: File): Promise<void> => {
      try {
        setMsg("Getting token...");
        const idToken = await getIdToken();
        if (!idToken) {
          setMsg("Not signed in");
          return;
        }

        setMsg("Uploading...");
        const url = `${FN_URL}?filename=${encodeURIComponent(file.name)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "text/csv",
            Authorization: `Bearer ${idToken}`,
          },
          body: file,
        });

        const dataUnknown = await readJsonSafe(res);
        // narrow to success/err structure loosely
        const okFlag =
          typeof dataUnknown === "object" &&
          dataUnknown !== null &&
          "ok" in dataUnknown &&
          (dataUnknown as { ok?: unknown }).ok === true;

        if (res.ok && okFlag) {
          const rowsCount =
            typeof (dataUnknown as { rowCount?: unknown }).rowCount === "number"
              ? String((dataUnknown as { rowCount?: unknown }).rowCount)
              : "?";
          setMsg(`Uploaded ✓ rows=${rowsCount}`);
          await fetchList(false); // refresh list
        } else {
          const message =
            typeof dataUnknown === "object" &&
            dataUnknown !== null &&
            "message" in dataUnknown &&
            typeof (dataUnknown as { message?: unknown }).message === "string"
              ? (dataUnknown as { message: string }).message
              : "Upload failed";
          setMsg(`Failed: ${message}`);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setMsg(`Failed: ${message}`);
      }
    },
    [getIdToken, fetchList]
  );

  // pretty selected filename
  const selectedSummary = useMemo(() => {
    if (!detailFor) return "";
    const m = items.find((i) => i.uploadId === detailFor);
    return m
      ? `${m.filename} • ${new Date(m.uploadedAt).toLocaleString()}`
      : detailFor;
  }, [detailFor, items]);

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center py-10">
      <div className="bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-center">Clinic Uploads</h1>

        {/* Uploader */}
        <label className="block mb-4">
          <span className="block mb-2 text-gray-300">Choose CSV file</span>
          <input
            type="file"
            accept=".csv"
            className="block w-full text-sm text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </label>

        <p className="mt-3 text-sm min-h-[1.5em] text-gray-400">{msg}</p>

        <div className="flex items-center gap-3">
          <button
            className="mt-2 px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
            onClick={() => void fetchList(false)}
            disabled={loadingList}
          >
            {loadingList ? "Refreshing..." : "Refresh list"}
          </button>
          {nextKey && (
            <button
              className="mt-2 px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
              onClick={() => void fetchList(true, nextKey)}
              disabled={loadingList}
            >
              Load more
            </button>
          )}
        </div>

        {/* My uploads */}
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-300">
                <th className="p-2">File</th>
                <th className="p-2">Uploaded</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Rows</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="p-2 text-gray-400" colSpan={5}>
                    No uploads yet.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.SK} className="border-t border-gray-700">
                    <td className="p-2">{it.filename}</td>
                    <td className="p-2">
                      {new Date(it.uploadedAt).toLocaleString()}
                    </td>
                    <td className="p-2">{it.status}</td>
                    <td className="p-2 text-right">{it.rowCount}</td>
                    <td className="p-2 text-right">
                      <button
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          setDetailFor(it.uploadId);
                          setRows([]);
                          setRowsNextKey(undefined);
                          void fetchDetail(it.uploadId);
                        }}
                      >
                        View rows
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail viewer */}
        {detailFor && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Rows for: {selectedSummary}
              </h2>
              <div className="flex gap-2">
                {rowsNextKey && (
                  <button
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                    onClick={() =>
                      void fetchDetail(detailFor, rowsNextKey, true)
                    }
                    disabled={loadingRows}
                  >
                    {loadingRows ? "Loading..." : "Load more rows"}
                  </button>
                )}
                <button
                  className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                  onClick={() => {
                    setDetailFor(null);
                    setRows([]);
                    setRowsNextKey(undefined);
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-300">
                    <th className="p-2">Patient</th>
                    <th className="p-2">Test</th>
                    <th className="p-2">Value</th>
                    <th className="p-2">Unit</th>
                    <th className="p-2">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="p-2 text-gray-400" colSpan={5}>
                        {loadingRows ? "Loading..." : "No rows yet."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
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

        {/* Dev helper */}
        <button
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors"
          onClick={async () => {
            const { tokens } = await fetchAuthSession();
            await navigator.clipboard.writeText(
              tokens?.idToken?.toString() ?? ""
            );
            alert("ID token copied");
          }}
        >
          Copy ID token
        </button>
      </div>
    </main>
  );
}
