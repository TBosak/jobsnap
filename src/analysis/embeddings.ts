import type { JDItem } from "../ui-shared/types.jd";

interface PendingRequest {
  resolve: (value: number[][]) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
const pending = new Map<string, PendingRequest>();
let counter = 0;
const cache = new Map<string, number[]>();

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/embedding.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", handleMessage);
    worker.postMessage({ id: generateId(), type: "warmup" });
  }
  return worker;
}

function handleMessage(event: MessageEvent<{ id: string; ok: boolean; data?: number[][]; error?: string }>) {
  const { id, ok, data, error } = event.data;
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  if (ok) {
    entry.resolve(data ?? []);
  } else {
    entry.reject(new Error(error ?? "Embedding worker error"));
  }
}

function generateId() {
  counter += 1;
  return `req-${counter}`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const ids: string[] = [];
  const misses: string[] = [];
  const results: number[][] = [];

  texts.forEach((text, index) => {
    const key = text.trim();
    ids[index] = key;
    if (cache.has(key)) {
      results[index] = cache.get(key)!;
    } else {
      misses.push(key);
    }
  });

  if (misses.length) {
    const response = await requestEmbeddings(misses);
    misses.forEach((key, idx) => {
      const vec = response[idx];
      cache.set(key, vec);
    });
    texts.forEach((text, index) => {
      const key = ids[index];
      if (!results[index]) {
        results[index] = cache.get(key)!;
      }
    });
  }

  return results;
}

async function requestEmbeddings(texts: string[]): Promise<number[][]> {
  const worker = ensureWorker();
  return new Promise((resolve, reject) => {
    const id = generateId();
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type: "embed", payload: { texts, normalize: true } });
  });
}

export async function embedCollection(items: JDItem[]): Promise<number[][]> {
  const texts = items.map((item) => item.text);
  return embedTexts(texts);
}
