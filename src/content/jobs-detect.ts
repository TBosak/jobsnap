import { extractJobPosting } from "./job-adapters";
import { cleanHTMLElement } from "../ui-shared/sanitize";
import type { JDAddItemPayload } from "../ui-shared/messaging";
import type { JDCollection } from "../ui-shared/types.jd";

export interface JobContext {
  title?: string;
  company?: string;
  text: string;
  url: string;
  host: string;
}

type JobListener = (context: JobContext | null) => void;

const jobListeners = new Set<JobListener>();
let currentContext: JobContext | null = null;

export function initJobDetection(listener?: JobListener) {
  if (listener) {
    jobListeners.add(listener);
    // Immediately inform new listeners of the current state
    try {
      listener(currentContext);
    } catch (error) {
      console.warn("JobSnap job listener error", error);
    }
  }

  tryInit();
  const observer = new MutationObserver(() => {
    if (!document.body) return;
    tryInit();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    if (listener) {
      jobListeners.delete(listener);
    }
  };
}

export function getJobContext(): JobContext | null {
  return currentContext;
}

function tryInit() {
  getCurrentExtraction().then((extract) => {
    if (!extract) {
      setJobContext(null);
      return;
    }
    setJobContext({
      title: extract.title,
      company: extract.company,
      text: extract.text,
      url: location.href,
      host: location.host
    });
  }).catch((error) => {
    console.warn("JobSnap extraction error", error);
    setJobContext(null);
  });
}

async function getCurrentExtraction() {
  const url = new URL(location.href);
  const baseExtract = await extractJobPosting(document, url) ?? getFallbackExtraction(url);
  if (!baseExtract) return null;
  const text = cleanText(baseExtract.text);
  if (!text || text.length < 150) return null;
  return { ...baseExtract, text };
}

function getFallbackExtraction(url: URL) {
  if (url.hostname.endsWith(".lever.co")) {
    const description =
      document.querySelector<HTMLElement>(
        ".posting-description, [data-qa='posting-description'], .posting-contents, .posting .content, main, article, body"
      ) ?? document.body;
    if (!description) return null;
    const text = description.innerHTML || description.textContent || "";
    if (!text.trim()) return null;
    const title =
      document
        .querySelector<HTMLElement>(
          ".posting-headline h2, .posting-headline h1, [data-qa='posting-name'], [data-qa='job-title'], h1"
        )
        ?.innerText.trim() || document.title;
    return {
      title,
      company: document
        .querySelector<HTMLElement>(
          ".posting-headline [data-qa='company-name'], .posting-headline .company, .posting-headline [data-company]"
        )
        ?.innerText.trim(),
      text
    };
  }
  if (url.hostname.endsWith(".greenhouse.io")) {
    const description =
      document.querySelector<HTMLElement>(
        "[data-qa='posting-description'], .job__description, main .job-post, main, article, body"
      ) ?? document.body;
    if (!description) return null;
    const text = description.innerHTML || description.textContent || "";
    if (!text.trim()) return null;
    const title =
      document
        .querySelector<HTMLElement>(
          "#content h1, .posting-headline h1, .job__title h1, [data-qa='posting-name'], [data-qa='job-title'], h1"
        )
        ?.innerText.trim() || document.title;
    return {
      title,
      company: document
        .querySelector<HTMLElement>(".company-name, [data-qa='company-name'], .job__company")
        ?.innerText.trim(),
      text
    };
  }
  return null;
}

function cleanText(htmlText: string): string {
  // If the text contains HTML tags, preserve them (it's from JSON-LD or clean source)
  // Just do basic cleanup of the HTML
  if (/<[a-z][\s\S]*>/i.test(htmlText)) {
    const container = document.createElement("div");
    container.innerHTML = htmlText;

    // Remove script and style tags but keep the HTML structure
    container.querySelectorAll("script, style, noscript").forEach(el => el.remove());

    // Return the cleaned HTML
    return container.innerHTML.trim();
  }

  // Otherwise, treat it as plain text extraction that needs full cleaning
  const container = document.createElement("div");
  container.innerHTML = htmlText;
  return cleanHTMLElement(container);
}

function setJobContext(context: JobContext | null) {
  currentContext = context;
  jobListeners.forEach((listener) => {
    try {
      listener(currentContext);
    } catch (error) {
      console.warn("JobSnap job listener error", error);
    }
  });
}

export async function saveCurrentJobToCollections(): Promise<string | null> {
  if (!currentContext) {
    throw new Error("NO_JOB_CONTEXT");
  }

  // If we're on a Lever application form, fetch the job description from the actual job posting page
  const url = new URL(currentContext.url);
  if (url.hostname.endsWith(".lever.co") && url.pathname.endsWith("/apply")) {
    try {
      const jobPostingUrl = url.pathname.replace(/\/apply$/, "");
      const fullJobPostingUrl = `${url.origin}${jobPostingUrl}`;

      showToast("Fetching job...");

      const response = await fetch(fullJobPostingUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch job");
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract job posting from the fetched page
      const extraction = extractJobPosting(doc, new URL(fullJobPostingUrl));
      if (extraction && extraction.text) {
        const cleanedText = cleanText(extraction.text);
        if (cleanedText && cleanedText.length >= 150) {
          // Use the fetched job description with updated URL
          const enhancedContext: JobContext = {
            title: extraction.title || currentContext.title,
            company: extraction.company || currentContext.company,
            text: cleanedText,
            url: fullJobPostingUrl, // Use the job posting URL, not the application form URL
            host: url.host
          };
          return saveJobWithContext(enhancedContext);
        }
      }

      // If extraction failed, show warning but proceed with current context
      console.warn("JobSnap: Failed to extract job posting from Lever job page, using current context");
      showToast("Using description from application page", false);
    } catch (error) {
      console.error("JobSnap: Failed to fetch Lever job posting", error);
      showToast("Using description from application page", false);
      // Fall through to use current context
    }
  }

  return saveJobWithContext(currentContext);
}

async function saveJobWithContext(context: JobContext): Promise<string | null> {
  const collectionId = await chooseCollection();
  if (!collectionId) {
    return null;
  }

  const tokens = context.text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean).length;

  const payload: JDAddItemPayload = {
    collectionId,
    source: {
      host: context.host,
      url: context.url,
      capturedAt: Date.now()
    },
    title: context.title || document.title,
    company: context.company,
    text: context.text,
    tokens
  };

  const id = await sendMessage({ type: "JD_ADD_ITEM", payload });
  if (typeof id === "string") {
    // Create a history entry with "saved" status for this job
    // This is important for when users save jobs directly (not via autofill)
    try {
      // Get the active profile to include in history
      let activeProfileId: string | undefined;
      try {
        const activeProfile = await sendMessage({ type: "GET_ACTIVE_PROFILE" });
        if (activeProfile && typeof activeProfile === "object" && "id" in activeProfile) {
          activeProfileId = (activeProfile as { id: string }).id;
        }
      } catch (error) {
        // No active profile, that's okay
        console.debug("No active profile for history entry:", error);
      }

      await sendMessage({
        type: "HISTORY_LOG_AUTOFILL",
        payload: {
          host: context.host,
          url: context.url,
          title: context.title || document.title,
          company: context.company,
          collectionId,
          jdItemId: id,
          profileId: activeProfileId,
          status: "saved"
        }
      });
    } catch (error) {
      console.warn("Failed to log job save to history:", error);
    }
    return id;
  }
  return null;
}

async function chooseCollection(): Promise<string | null> {
  const list = (await sendMessage({ type: "JD_LIST_COLLECTIONS" })) as JDCollection[] | undefined;
  const collections = Array.isArray(list) ? list : [];
  const result = await openCollectionDialog(collections);
  if (!result) return null;
  if (result.kind === "existing") {
    return result.id;
  }
  const id = await sendMessage({ type: "JD_CREATE_COLLECTION", name: result.name });
  if (typeof id === "string") {
    return id;
  }
  throw new Error("CREATE_COLLECTION_FAILED");
}

type CollectionDialogResult = { kind: "existing"; id: string } | { kind: "new"; name: string } | null;

function openCollectionDialog(collections: JDCollection[]): Promise<CollectionDialogResult> {
  const existing = document.getElementById("jobsnap-collection-dialog");
  if (existing) {
    existing.remove();
  }

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "jobsnap-collection-dialog";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(15, 23, 42, 0.45)";
    overlay.style.backdropFilter = "blur(2px)";
    overlay.style.zIndex = "2147483646";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "24px";

    const dialog = document.createElement("div");
    dialog.style.maxWidth = "360px";
    dialog.style.width = "100%";
    dialog.style.background = "white";
    dialog.style.borderRadius = "12px";
    dialog.style.boxShadow = "0 20px 40px rgba(15, 23, 42, 0.25)";
    dialog.style.padding = "20px";
    dialog.style.fontFamily = "system-ui, sans-serif";

    const title = document.createElement("h2");
    title.textContent = "Save to collection";
    title.style.margin = "0 0 12px";
    title.style.fontSize = "18px";
    title.style.fontWeight = "600";
    title.style.color = "#0f172a";

    const form = document.createElement("form");
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "12px";

    const listContainer = document.createElement("div");
    listContainer.style.display = "flex";
    listContainer.style.flexDirection = "column";
    listContainer.style.gap = "8px";

    if (collections.length) {
      const label = document.createElement("p");
      label.textContent = "Choose an existing collection";
      label.style.margin = "0";
      label.style.fontSize = "13px";
      label.style.fontWeight = "500";
      label.style.color = "#475569";
      form.appendChild(label);

      collections.forEach((collection, index) => {
        const option = document.createElement("label");
        option.style.display = "flex";
        option.style.alignItems = "center";
        option.style.gap = "10px";
        option.style.padding = "8px 10px";
        option.style.borderRadius = "8px";
        option.style.border = "1px solid #e2e8f0";
        option.style.cursor = "pointer";

        option.addEventListener("mouseenter", () => {
          option.style.borderColor = "#cbd5f5";
          option.style.background = "#eef2ff";
        });
        option.addEventListener("mouseleave", () => {
          option.style.borderColor = "#e2e8f0";
          option.style.background = "transparent";
        });

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "jobsnap-collection-choice";
        input.value = collection.id;
        input.style.margin = "0";
        if (index === 0) {
          input.checked = true;
        }

        const info = document.createElement("div");
        info.style.display = "flex";
        info.style.flexDirection = "column";
        info.style.gap = "2px";

        const name = document.createElement("span");
        name.textContent = collection.name;
        name.style.fontSize = "14px";
        name.style.fontWeight = "600";
        name.style.color = "#0f172a";

        const meta = document.createElement("span");
        meta.textContent = new Date(collection.updatedAt).toLocaleString();
        meta.style.fontSize = "10px";
        meta.style.textTransform = "uppercase";
        meta.style.letterSpacing = "0.05em";
        meta.style.color = "#94a3b8";

        info.appendChild(name);
        info.appendChild(meta);

        option.appendChild(input);
        option.appendChild(info);
        listContainer.appendChild(option);
      });
    }

    const divider = document.createElement("div");
    divider.style.height = "1px";
    divider.style.background = "#e2e8f0";
    divider.style.margin = "4px 0";

    const newLabel = document.createElement("label");
    newLabel.textContent = collections.length ? "Or create a new collection" : "Create a collection";
    newLabel.style.fontSize = "13px";
    newLabel.style.fontWeight = "500";
    newLabel.style.color = "#475569";

    const newInput = document.createElement("input");
    newInput.type = "text";
    newInput.placeholder = "Collection name";
    newInput.style.width = "100%";
    newInput.style.padding = "10px";
    newInput.style.borderRadius = "8px";
    newInput.style.border = "1px solid #cbd5e1";
    newInput.style.fontSize = "14px";
    newInput.style.boxSizing = "border-box";

    const errorMessage = document.createElement("p");
    errorMessage.style.margin = "0";
    errorMessage.style.fontSize = "12px";
    errorMessage.style.color = "#dc2626";
    errorMessage.style.minHeight = "16px";

    const buttons = document.createElement("div");
    buttons.style.display = "flex";
    buttons.style.justifyContent = "flex-end";
    buttons.style.gap = "12px";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.style.background = "transparent";
    cancelButton.style.border = "none";
    cancelButton.style.color = "#64748b";
    cancelButton.style.fontSize = "14px";
    cancelButton.style.fontWeight = "500";
    cancelButton.style.cursor = "pointer";

    const confirmButton = document.createElement("button");
    confirmButton.type = "submit";
    confirmButton.textContent = "Save";
    confirmButton.style.background = "#2563eb";
    confirmButton.style.border = "none";
    confirmButton.style.color = "white";
    confirmButton.style.fontSize = "14px";
    confirmButton.style.fontWeight = "600";
    confirmButton.style.padding = "8px 16px";
    confirmButton.style.borderRadius = "9999px";
    confirmButton.style.cursor = "pointer";

    buttons.appendChild(cancelButton);
    buttons.appendChild(confirmButton);

    if (collections.length) {
      form.appendChild(listContainer);
      form.appendChild(divider);
    }
    form.appendChild(newLabel);
    form.appendChild(newInput);
    form.appendChild(errorMessage);
    form.appendChild(buttons);

    dialog.appendChild(title);
    dialog.appendChild(form);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const focusTarget = collections.length
      ? (listContainer.querySelector("input[name='jobsnap-collection-choice']") as HTMLInputElement | null)
      : newInput;
    (focusTarget ?? newInput).focus();

    function cleanup(result: CollectionDialogResult) {
      overlay.remove();
      document.removeEventListener("keydown", handleKeydown, true);
      resolve(result);
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(null);
      }
    }

    document.addEventListener("keydown", handleKeydown, true);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup(null);
      }
    });

    cancelButton.addEventListener("click", () => cleanup(null));

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = newInput.value.trim();
      if (name.length > 0) {
        cleanup({ kind: "new", name });
        return;
      }
      if (collections.length) {
        const selected = form.querySelector<HTMLInputElement>("input[name='jobsnap-collection-choice']:checked");
        if (selected) {
          cleanup({ kind: "existing", id: selected.value });
          return;
        }
      }
      errorMessage.textContent = "Select a collection or enter a name.";
    });
  });
}

function showToast(message: string, error = false) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = error ? "#dc2626" : "#0f766e";
  toast.style.color = "white";
  toast.style.padding = "10px 16px";
  toast.style.borderRadius = "9999px";
  toast.style.boxShadow = "0 10px 20px rgba(15, 118, 110, 0.35)";
  toast.style.zIndex = "2147483646";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "JOBSNAP_CONTEXT_SAVE") {
    const selectedText = message.text as string;
    if (!selectedText || selectedText.trim().length < 20) {
      showToast("Selection too short", true);
      sendResponse({ ok: false });
      return true;
    }

    // Use the selected text as the job description, but preserve existing context metadata
    const context = currentContext;
    const enhancedContext: JobContext = {
      title: context?.title || document.title,
      company: context?.company,
      text: selectedText.trim(),
      url: location.href,
      host: location.host
    };

    // Save with the enhanced context directly
    saveJobWithContext(enhancedContext)
      .then((savedId) => {
        if (savedId) {
          showToast("Saved selection to JobSnap");
          sendResponse({ ok: true });
        } else {
          showToast("Save cancelled", true);
          sendResponse({ ok: false });
        }
      })
      .catch((error) => {
        console.error("JobSnap selection save failed", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        showToast(`Save failed: ${errorMessage}`, true);
        sendResponse({ ok: false });
      });
    return true;
  }
  if (message?.type === "JOBSNAP_SHOW_TOAST") {
    showToast(message.message, message.error);
    return false;
  }
  return false;
});

function sendMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error("NO_RESPONSE"));
        return;
      }
      if (response.ok) {
        resolve(response.data);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}
