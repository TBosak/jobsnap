/// <reference lib="webworker" />

import { pipeline, env } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const ctx: DedicatedWorkerGlobalScope = self;

type WorkerRequest =
  | { id: string; type: "embed"; payload: { texts: string[]; normalize?: boolean } }
  | { id: string; type: "warmup" };

type WorkerResponse = { id: string; ok: true; data: number[][] } | { id: string; ok: false; error: string };

let extractor: any | null = null;
let loading = false;
let wasmBasePath: string | null = null;

async function ensureExtractor() {
  if (extractor || loading) {
    while (loading && !extractor) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return extractor;
  }
  loading = true;
  try {
    const basePath = wasmBasePath ?? new URL("../transformers/", ctx.location.href).toString();
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    env.backends.onnx.wasm.wasmPaths = basePath;
    extractor = await pipeline("feature-extraction", "mixedbread-ai/mxbai-embed-xsmall-v1", {
      device: "wasm",
      quantized: true
    });
  } catch (error) {
    console.error("JobSnap embedding worker failed to load model", error);
    throw error;
  } finally {
    loading = false;
  }
  return extractor;
}

async function handleEmbed(texts: string[], normalize = true): Promise<number[][]> {
  const model = await ensureExtractor();
  const outputs = await model(texts, { pooling: "mean", normalize });
  return outputs.tolist ? outputs.tolist() : outputs;
}

ctx.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const { id, type } = event.data;
  (async () => {
    try {
      if (type === "embed") {
        const data = await handleEmbed(event.data.payload.texts, event.data.payload.normalize);
        respond({ id, ok: true, data });
      } else if (type === "warmup") {
        await ensureExtractor();
        respond({ id, ok: true, data: [] });
      } else if (type === "warmup") {
        await ensureExtractor();
        respond({ id, ok: true, data: [] });
      }
    } catch (error) {
      respond({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
});

function respond(message: WorkerResponse) {
  ctx.postMessage(message);
}

// Initialize default wasm base path once worker loads
try {
  wasmBasePath = new URL("../transformers/", ctx.location.href).toString();
} catch {
  wasmBasePath = null;
}

export {};
