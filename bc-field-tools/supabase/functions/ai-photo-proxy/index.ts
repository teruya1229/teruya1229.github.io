/**
 * BC現場写真診断 — AI写真解析受け口（内部ツール・ログイン無し）
 *
 * - verify_jwt = false（ユーザーJWT不要）
 * - CORS は許可 Origin のみ（POSTは Origin 必須）
 * - 連打対策: クライアント別 rate limit + 日次グローバル上限（in-memory）
 * - multipart は JPEG 1枚 + survey slotKey + 任意の現場コンテキストJSON
 * - OpenAI Responses API（store:false, detail:high, 1画像, 出力上限）
 * - 構造化JSON + 禁止表現フィルタ後、suggested 候補のみ返却
 * - OpenAI処理全体（fetch〜本文読取り〜JSON解析〜抽出）を45秒で打ち切り
 * - 写真・キー・Authorization・全文レスポンスはログしない
 */

import {
  MAX_JPEG_BYTES,
  MAX_OUTPUT_TOKENS,
  MAX_REQUEST_BYTES,
  OPENAI_OPERATION_TIMEOUT_MS,
  SLOT_GUIDANCE,
  checkClientRateLimit,
  checkDailyGlobalBudget,
  classifyOpenAIFetchError,
  clientKeyFromRequest,
  containsUnsafePhrase,
  isSurveySlotKey,
  parseReadingPayload,
  readingToScanText,
} from "./safety.ts";

const ALLOWED_ORIGINS = new Set([
  "https://teruya1229.github.io",
  "http://127.0.0.1:5500",
]);

const OPENAI_MODEL = "gpt-4o-mini";

/** In-memory abuse controls (best-effort per isolate). */
const clientRateBuckets = new Map<string, number[]>();
const dailyBudgetState = { day: "", count: 0 };

const SYSTEM_INSTRUCTION = [
  "エアコン取付・専用回路工事の現場調査補助として、写真から見える事実候補を日本語JSONで返す。",
  "目的は現場判断・材料準備・撮り忘れ防止・見積候補の補助。画像説明やOCR自体が目的ではない。",
  "施工可否・安全・活線・電線サイズ・遮断器定格・接続方法・正確なドレン勾配・隠蔽物は断定しない。",
  "型番は見える文字だけ。推測しない。価格は出さない。",
  "距離は根拠が弱いなら推定不可。数字を捏造しない。AI想定長は材料準備用であり見積課金mではない。",
  "人間確認済みの値と食い違う場合は warnings に書く。どちらかを勝手に採用しない。",
  "追加写真が必要なら nextPhotos に具体的な撮り方を書く。",
].join("");

const STRING300 = { type: "string", maxLength: 300 };
const CONF = { type: "string", enum: ["low", "medium", "high"] };

const READING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "category",
    "summary",
    "visibleFacts",
    "fieldCandidates",
    "workCandidates",
    "estimateCandidates",
    "materialPlanCandidates",
    "warnings",
    "missingInformation",
    "nextPhotos",
    "evidence",
    "uncertainty",
    "requiredMeasurements",
  ],
  properties: {
    category: {
      type: "string",
      enum: [
        "panel_label",
        "breaker_label",
        "outlet_label",
        "route_observation",
        "other_visible_observation",
      ],
    },
    summary: STRING300,
    visibleFacts: { type: "array", maxItems: 8, items: STRING300 },
    fieldCandidates: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["targetField", "proposedValue", "confidence", "reason", "evidence", "requiresHumanConfirmation"],
        properties: {
          targetField: {
            type: "string",
            enum: [
              "acVoltage",
              "dedicatedCircuit",
              "outdoorPlace",
              "hole",
              "cover",
              "wiringRoute",
              "voltChange",
              "spareCircuit",
              "other",
            ],
          },
          proposedValue: STRING300,
          confidence: CONF,
          reason: STRING300,
          evidence: STRING300,
          requiresHumanConfirmation: { type: "boolean" },
        },
      },
    },
    workCandidates: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "reason", "confidence"],
        properties: {
          key: {
            type: "string",
            enum: [
              "install",
              "remove",
              "dedicated",
              "volt_change",
              "hole",
              "cover",
              "pipe_ext",
              "wire_ext",
              "roof_wall",
              "other",
            ],
          },
          label: STRING300,
          reason: STRING300,
          confidence: CONF,
        },
      },
    },
    estimateCandidates: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["catalogId", "label", "reason"],
        properties: {
          catalogId: {
            type: "string",
            enum: [
              "install_std",
              "remove_std",
              "remove_floor",
              "roof_wall",
              "pipe_ext",
              "cover",
              "dedicated",
              "volt_change",
              "hole",
              "wire_ext",
              "angle",
              "none",
            ],
          },
          label: STRING300,
          reason: STRING300,
        },
      },
    },
    materialPlanCandidates: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "material",
          "role",
          "label",
          "estimatedMin",
          "estimatedMax",
          "unit",
          "confidence",
          "requiresMeasurement",
          "basis",
        ],
        properties: {
          material: {
            type: "string",
            enum: [
              "refrigerant_pipe",
              "insulated_drain",
              "drain_hose",
              "power_cable",
              "interconnect",
              "cover",
              "sleeve",
              "putty",
              "stand",
              "bend",
              "terminal",
              "joint",
              "drain_fitting",
              "other",
            ],
          },
          role: { type: "string", enum: ["indoor", "outdoor", "prep", "unknown"] },
          label: STRING300,
          estimatedMin: { type: "number" },
          estimatedMax: { type: "number" },
          unit: STRING300,
          confidence: CONF,
          requiresMeasurement: { type: "boolean" },
          basis: STRING300,
        },
      },
    },
    warnings: { type: "array", maxItems: 6, items: STRING300 },
    missingInformation: { type: "array", maxItems: 6, items: STRING300 },
    nextPhotos: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["instruction"],
        properties: { instruction: STRING300 },
      },
    },
    evidence: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "text"],
        properties: {
          kind: { type: "string", enum: ["visible_text", "visible_mark", "visible_condition"] },
          text: STRING300,
        },
      },
    },
    uncertainty: { type: "array", maxItems: 6, items: STRING300 },
    requiredMeasurements: { type: "array", maxItems: 6, items: STRING300 },
  },
};

function buildSlotPrompt(slotKey: string, contextJson: string): string {
  const g = SLOT_GUIDANCE[slotKey];
  const lines = [
    SYSTEM_INSTRUCTION,
    g ? `写真枠: ${g.title}（${slotKey}）` : `写真枠: ${slotKey}`,
    g ? `この写真の目的: ${g.purpose}` : "",
    g ? `確認観点: ${g.expected}` : "",
    g ? `禁止: ${g.forbid}` : "",
    "fieldCandidates の requiresHumanConfirmation は必ず true。",
    "100V/200V が見えたら targetField=acVoltage, proposedValue は 100V または 200V のみ。電圧を other に入れない。",
    "hole/cover/dedicatedCircuit/spareCircuit の proposedValue は あり または なし。outdoorPlace は 通常/屋根/壁面/天吊り/二段置き/別階/その他。",
    "穴・カバー・屋根/壁面・専用回路なし が見えたら対応する targetField に入れる。型番確認は nextPhotos。",
    "距離が弱いときは estimatedMin/estimatedMax を 0 にし basis に推定不可と書く。",
    "室内を通るドレンは insulated_drain、屋外露出は drain_hose を候補にする。",
    "見積価格は出さない。catalogId が無い工事は none。",
  ];
  if (contextJson) {
    lines.push("現場コンテキストJSON:");
    lines.push(contextJson.slice(0, 4000));
  }
  return lines.filter(Boolean).join("\n");
}

function buildCorsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function isBlockedOrigin(origin: string | null): boolean {
  return !(typeof origin === "string" && origin.length > 0 && ALLOWED_ORIGINS.has(origin));
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders?: Headers,
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const output = data.output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (let i = 0; i < output.length; i++) {
    const item = output[i];
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (let j = 0; j < content.length; j++) {
      const part = content[j];
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      // Prefer output_text once; do not also match the generic text branch (would duplicate JSON).
      if (p.type === "output_text" && typeof p.text === "string") {
        chunks.push(p.text);
      } else if (typeof p.text === "string" && p.type !== "refusal") {
        chunks.push(p.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

type OpenAICallResult =
  | { ok: true; reading: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string };

function makeTimeoutError(): Error {
  const err = new Error("model_timeout");
  err.name = "AbortError";
  return err;
}

/**
 * Run OpenAI fetch + body read + JSON parse + output extract under one deadline.
 * Timers are cleared only after the raced operation settles (success or error path).
 */
async function callOpenAI(jpegBytes: Uint8Array, slotKey: string, contextJson: string): Promise<OpenAICallResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      code: "ai_not_configured",
      message: "AI写真読取はまだ有効化されていません",
    };
  }

  let base64 = bytesToBase64(jpegBytes);
  const imageUrl = "data:image/jpeg;base64," + base64;
  // Drop intermediate string reference after embedding in payload construction.
  base64 = "";

  const payload: {
    model: string;
    store: boolean;
    max_output_tokens: number;
    input: Array<{
      role: string;
      content: Array<Record<string, unknown>>;
    }>;
    text: Record<string, unknown>;
  } = {
    model: OPENAI_MODEL,
    store: false,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: buildSlotPrompt(slotKey, contextJson) },
          { type: "input_image", image_url: imageUrl, detail: "high" },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "bc_field_photo_reading",
        strict: true,
        schema: READING_SCHEMA,
      },
    },
  };

  const controller = new AbortController();
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

  const clearDeadline = () => {
    if (deadlineTimer !== undefined) {
      clearTimeout(deadlineTimer);
      deadlineTimer = undefined;
    }
  };

  const openAiOperation = (async (): Promise<OpenAICallResult> => {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Do NOT clear deadline here — body read + parse remain under the same budget.
    payload.input[0].content[1] = { type: "input_image", image_url: "", detail: "high" };

    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch (err) {
      const classified = classifyOpenAIFetchError(err);
      if (classified) return { ok: false, ...classified };
      return {
        ok: false,
        status: 502,
        code: "upstream_unavailable",
        message: "写真は保存されていません。時間をおいて再試行してください",
      };
    }

    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      data = null;
    }
    bodyText = "";

    if (res.status === 429) {
      return {
        ok: false,
        status: 429,
        code: "rate_limited",
        message: "少し待ってから再試行してください",
      };
    }
    if (res.status >= 500 || res.status === 408) {
      return {
        ok: false,
        status: 502,
        code: "upstream_error",
        message: "写真は保存されていません。時間をおいて再試行してください",
      };
    }
    if (!res.ok || !data) {
      return {
        ok: false,
        status: 502,
        code: "upstream_error",
        message: "写真は保存されていません。時間をおいて再試行してください",
      };
    }

    const text = extractOutputText(data);
    data = null;
    if (!text) {
      return {
        ok: false,
        status: 502,
        code: "model_output_invalid",
        message: "AI候補を安全に表示できませんでした。写真と現地を確認してください",
      };
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: 502,
        code: "model_output_invalid",
        message: "AI候補を安全に表示できませんでした。写真と現地を確認してください",
      };
    }

    const reading = parseReadingPayload(parsed);
    if (!reading) {
      return {
        ok: false,
        status: 502,
        code: "model_output_invalid",
        message: "AI候補を安全に表示できませんでした。写真と現地を確認してください",
      };
    }

    if (containsUnsafePhrase(readingToScanText(reading))) {
      return {
        ok: false,
        status: 502,
        code: "model_output_unsafe",
        message: "安全上の表現を検出したため候補を表示しません。現地確認を行ってください。",
      };
    }

    return { ok: true, reading };
  })();

  // Normalize rejections so Promise.race always yields a result object.
  const safeOperation: Promise<OpenAICallResult> = openAiOperation.then(
    (value) => value,
    (err) => {
      const classified = classifyOpenAIFetchError(err);
      if (classified) return { ok: false, ...classified };
      return {
        ok: false,
        status: 502,
        code: "upstream_unavailable",
        message: "写真は保存されていません。時間をおいて再試行してください",
      };
    },
  );

  const deadlinePromise = new Promise<OpenAICallResult>((resolve) => {
    deadlineTimer = setTimeout(() => {
      controller.abort();
      resolve({
        ok: false,
        status: 504,
        code: "model_timeout",
        message:
          "AIの読取りが45秒以内に完了しませんでした。写真は保存されていません。",
      });
    }, OPENAI_OPERATION_TIMEOUT_MS);
  });

  try {
    const raced = await Promise.race([safeOperation, deadlinePromise]);
    // If deadline won, detach still-running OpenAI work so Edge can flush HTTP.
    if (!raced.ok && raced.code === "model_timeout") {
      const background = safeOperation.then(() => undefined);
      const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
        .EdgeRuntime;
      if (edgeRuntime && typeof edgeRuntime.waitUntil === "function") {
        edgeRuntime.waitUntil(background);
      }
    }
    return raced;
  } finally {
    clearDeadline();
  }
}

export default {
  fetch: async (req: Request): Promise<Response> => {
    const origin = req.headers.get("Origin");
    const cors = buildCorsHeaders(origin);
    const requestId = crypto.randomUUID();

    if (req.method === "OPTIONS") {
      if (isBlockedOrigin(origin)) {
        return jsonResponse(403, {
          ok: false,
          code: "origin_forbidden",
          message: "Origin is not allowed.",
        });
      }
      return new Response("ok", { status: 200, headers: cors });
    }

    if (req.method !== "POST") {
      const headers = new Headers(cors);
      headers.set("Allow", "POST, OPTIONS");
      return jsonResponse(
        405,
        { ok: false, code: "method_not_allowed", message: "Method not allowed." },
        headers,
      );
    }

    if (isBlockedOrigin(origin)) {
      return jsonResponse(403, {
        ok: false,
        code: "origin_forbidden",
        message: "Origin is not allowed.",
      });
    }

    const contentLengthRaw = req.headers.get("content-length");
    if (contentLengthRaw) {
      const contentLength = Number(contentLengthRaw);
      if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
        return jsonResponse(
          413,
          {
            ok: false,
            code: "payload_too_large",
            requestId,
            message: "写真は4MB以下のJPEGにしてください",
          },
          cors,
        );
      }
    }

    const nowMs = Date.now();
    const rate = checkClientRateLimit(clientRateBuckets, clientKeyFromRequest(req), nowMs);
    if (!rate.ok) {
      const headers = new Headers(cors);
      headers.set("Retry-After", String(rate.retryAfterSec));
      return jsonResponse(
        429,
        {
          ok: false,
          code: "rate_limited",
          requestId,
          message: "AI読取の利用が集中しています。しばらくしてからもう一度お試しください。",
        },
        headers,
      );
    }

    if (!Deno.env.get("OPENAI_API_KEY")) {
      return jsonResponse(
        503,
        {
          ok: false,
          code: "ai_not_configured",
          requestId,
          message: "AI写真読取はまだ有効化されていません",
        },
        cors,
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonResponse(
        400,
        {
          ok: false,
          code: "invalid_multipart",
          requestId,
          message: "JPEG写真と対象枠を確認してください",
        },
        cors,
      );
    }

    const slotKeyRaw = form.get("slotKey");
    const slotKey = typeof slotKeyRaw === "string" ? slotKeyRaw.trim() : "";
    if (!slotKey || !isSurveySlotKey(slotKey)) {
      return jsonResponse(
        400,
        {
          ok: false,
          code: "invalid_slot",
          requestId,
          message: "JPEG写真と対象枠を確認してください",
        },
        cors,
      );
    }

    const photoEntries = form.getAll("photo");
    if (photoEntries.length !== 1) {
      return jsonResponse(
        400,
        {
          ok: false,
          code: "invalid_photo_count",
          requestId,
          message: "JPEG写真と対象枠を確認してください",
        },
        cors,
      );
    }

    const photo = photoEntries[0];
    if (!(photo instanceof File)) {
      return jsonResponse(
        400,
        {
          ok: false,
          code: "invalid_photo",
          requestId,
          message: "JPEG写真と対象枠を確認してください",
        },
        cors,
      );
    }

    const mime = String(photo.type || "").toLowerCase();
    if (mime !== "image/jpeg") {
      return jsonResponse(
        400,
        {
          ok: false,
          code: "invalid_mime",
          requestId,
          message: "JPEG写真と対象枠を確認してください",
        },
        cors,
      );
    }

    if (photo.size <= 0) {
      return jsonResponse(
        400,
        {
          ok: false,
          code: "empty_photo",
          requestId,
          message: "JPEG写真と対象枠を確認してください",
        },
        cors,
      );
    }

    if (photo.size > MAX_JPEG_BYTES) {
      return jsonResponse(
        413,
        {
          ok: false,
          code: "payload_too_large",
          requestId,
          message: "写真は4MB以下のJPEGにしてください",
        },
        cors,
      );
    }

    let jpegBytes: Uint8Array | null = new Uint8Array(await photo.arrayBuffer());
    if (!jpegBytes || jpegBytes.byteLength === 0) {
      jpegBytes = null;
      return jsonResponse(
        400,
        {
          ok: false,
          code: "empty_photo",
          requestId,
          message: "JPEG写真と対象枠を確認してください",
        },
        cors,
      );
    }
    if (jpegBytes.byteLength > MAX_JPEG_BYTES) {
      jpegBytes = null;
      return jsonResponse(
        413,
        {
          ok: false,
          code: "payload_too_large",
          requestId,
          message: "写真は4MB以下のJPEGにしてください",
        },
        cors,
      );
    }

    const budget = checkDailyGlobalBudget(dailyBudgetState, Date.now());
    if (!budget.ok) {
      jpegBytes = null;
      return jsonResponse(
        503,
        {
          ok: false,
          code: "daily_quota_exceeded",
          requestId,
          message: "本日のAI読取上限に達しました。明日以降にもう一度お試しください。",
        },
        cors,
      );
    }

    const contextRaw = form.get("context");
    const contextJson = typeof contextRaw === "string" ? contextRaw.trim().slice(0, 4000) : "";

    const startedAt = Date.now();
    const result = await callOpenAI(jpegBytes, slotKey, contextJson);
    jpegBytes = null;
    const elapsedMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        requestId,
        stage: result.ok ? "openai_ok" : "openai_error",
        elapsedMs,
        code: result.ok ? "ok" : result.code,
        status: result.ok ? 200 : result.status,
      }),
    );

    if (!result.ok) {
      return jsonResponse(
        result.status,
        {
          ok: false,
          code: result.code,
          requestId,
          message: result.message,
        },
        cors,
      );
    }

    return jsonResponse(
      200,
      {
        ok: true,
        status: "suggested",
        slotKey,
        reading: result.reading,
        requestId,
      },
      cors,
    );
  },
};
