import type { ProfileRecord } from "../ui-shared/schema";
import type { FieldMap } from "./types";
import { getAdapterForHost } from "./adapters";

export function applyProfileToDocument(profile: ProfileRecord): void {
  const adapter = getAdapterForHost(window.location.hostname);
  const fieldMaps = adapter(profile) ?? [];
  console.log("JobSnap: applying profile", profile?.id, "with", fieldMaps.length, "mappings");
  for (const map of fieldMaps) {
    if (!map.selector) {
      continue;
    }
    const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(map.selector);
    if (!element) {
      continue;
    }
    const value = map.value;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      setElementValue(element, value ?? "");
    } else if (element instanceof HTMLSelectElement && value != null) {
      setSelectValue(element, value);
    }
  }

  for (const map of fieldMaps) {
    if (typeof map.apply === "function") {
      try {
        map.apply();
      } catch (error) {
        console.error("JobSnap greenhouse apply failure", error);
      }
    }
  }

  console.log("JobSnap: profile application finished");
}

function setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value") ??
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(element: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
