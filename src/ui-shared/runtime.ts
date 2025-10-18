import type { Msg, Reply } from "./messaging";

export function sendMessage<T = unknown>(message: Msg): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: Reply<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error("NO_RESPONSE"));
        return;
      }
      if (response.ok) {
        resolve(response.data as T);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}
