// src/app/api/reports/route.ts
import { NextRequest } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { CognitoJwtVerifier } from "aws-jwt-verify";

// --- AWS clients
const ddbDoc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
);

// --- Types
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

type ReportsOk = { items: UploadMeta[] };
type ReportsErr = { ok: false; error: string; message?: string };

// --- Helpers (type-safe extractors)
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number"
    ? v
    : typeof v === "string" && !Number.isNaN(Number(v))
    ? Number(v)
    : fallback;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function toUploadMeta(item: Record<string, unknown>): UploadMeta | null {
  const PK = asString(item.PK);
  const SK = asString(item.SK);
  if (!PK || !SK) return null;

  return {
    PK,
    SK,
    clinicId: asString(item.clinicId),
    uploadId: asString(item.uploadId),
    filename: asString(item.filename),
    s3Key: asString(item.s3Key),
    uploadedAt: asString(item.uploadedAt),
    status: asString(item.status),
    rowCount: asNumber(item.rowCount),
    uploadedByEmail: item.uploadedByEmail
      ? asString(item.uploadedByEmail)
      : undefined,
    uploadedBySub: item.uploadedBySub
      ? asString(item.uploadedBySub)
      : undefined,
    uploadedByUsername: item.uploadedByUsername
      ? asString(item.uploadedByUsername)
      : undefined,
  };
}

// --- Auth verifier (ID token)
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  clientId: process.env.COGNITO_APP_CLIENT_ID!,
  tokenUse: "id",
});

export async function GET(req: NextRequest) {
  try {
    // 1) Verify ID token
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const idt = await verifier.verify(token);

    const clinicId =
      (idt["custom:clinicId"] as string | undefined) ??
      asStringArray(idt["cognito:groups"] as unknown)[0] ??
      "unknown";

    // 2) Query DynamoDB (latest first)
    const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitParam) ? limitParam : 20;

    const out: QueryCommandOutput = await ddbDoc.send(
      new QueryCommand({
        TableName: process.env.REPORTS_TABLE!,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `CLINIC#${clinicId}`,
          ":sk": "UPLOAD#",
        },
        ScanIndexForward: false,
        Limit: limit,
      })
    );

    const itemsRaw = (out.Items ?? []) as Record<string, unknown>[];
    const items = itemsRaw
      .map(toUploadMeta)
      .filter((x): x is UploadMeta => x !== null);

    const body: ReportsOk = { items };
    return Response.json(body, { status: 200 });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : "Unauthorized or query failed";
    const body: ReportsErr = {
      ok: false,
      error: "Unauthorized or query failed",
      message,
    };
    return new Response(JSON.stringify(body), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
}
