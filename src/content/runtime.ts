import type { Msg, Reply } from "../ui-shared/messaging";
import type { ProfileRecord } from "../ui-shared/schema";
import { applyProfileToDocument } from "./strategy";
import { getJobContext, saveCurrentJobToCollections } from "./jobs-detect";
import { buildJobSignature, canonicalizeJobUrl, hashJobDescription } from "../ui-shared/jd-normalize";

type HistoryMatchServerReply = { id: string; match?: HistoryMatchInfo | null };

type HostGroupItem = {
  id: string;
  title?: string;
  company?: string;
  capturedAt: number;
  tags?: string[];
  url?: string;
};

type HostGroup = {
  collectionId: string;
  collectionName: string;
  items: HostGroupItem[];
};

interface HistoryMatchInfo {
  itemId: string;
  collectionId: string;
  collectionName: string;
  title?: string;
  company?: string;
  tier: string;
  score: number;
}

let activeHistoryToast: HTMLDivElement | null = null;

async function sendMessage<T = unknown>(message: Msg): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      reject(new Error("Chrome runtime not available. Extension may not be properly loaded."));
      return;
    }

    chrome.runtime.sendMessage(message, (response: Reply<T>) => {
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

export async function fillActiveProfile(): Promise<void> {
  console.log("JobSnap: autofill requested");
  const profile = await sendMessage<ProfileRecord>({ type: "GET_ACTIVE_PROFILE" });
  console.log("JobSnap: active profile loaded", profile ? profile.id : "none");
  applyProfileToDocument(profile);
  console.log("JobSnap: initial profile application complete");
  window.setTimeout(() => {
    try {
      applyProfileToDocument(profile);
      console.log("JobSnap: second pass applied");
    } catch (error) {
      console.warn("JobSnap retry fill failed", error);
    }
  }, 200);

  const jobContext = getJobContext();
  const canonicalUrl = canonicalizeJobUrl(location.href);
  const contextTitle = jobContext?.title ?? document.title;
  const contextCompany = jobContext?.company;
  const signature = buildJobSignature(contextTitle, contextCompany);
  const descHash = jobContext?.text ? hashJobDescription(jobContext.text.slice(0, 1200)) : undefined;

  try {
    const response = await sendMessage<HistoryMatchServerReply>({
      type: "HISTORY_LOG_AUTOFILL",
      payload: {
        host: location.host,
        url: location.href,
        canonicalUrl,
        title: contextTitle,
        company: contextCompany,
        profileId: profile.id,
        status: "saved",
        signature,
        descHash
      }
    });

    if (response && typeof response === "object" && typeof response.id === "string") {
      handleHistoryMatchResponse({
        historyId: response.id,
        host: location.host,
        match: response.match ?? null
      });
    }
  } catch (error) {
    console.warn("JobSnap history log failed", error);
  }

  window.setTimeout(() => {
    try {
      applyProfileToDocument(profile);
      console.log("JobSnap: third pass applied");
    } catch (error) {
      console.warn("JobSnap retry fill (2) failed", error);
    }
  }, 500);
}

function handleHistoryMatchResponse(params: { historyId: string; host: string; match: HistoryMatchInfo | null }) {
  showHistoryLinkToast(params);
}

function showHistoryLinkToast({ historyId, host, match }: { historyId: string; host: string; match: HistoryMatchInfo | null }) {
  dismissActiveToast();

  const toast = document.createElement("div");
  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.right = "24px";
  toast.style.maxWidth = "320px";
  toast.style.background = "#0f172a";
  toast.style.color = "white";
  toast.style.padding = "16px";
  toast.style.borderRadius = "16px";
  toast.style.boxShadow = "0 18px 36px rgba(15, 23, 42, 0.35)";
  toast.style.zIndex = "2147483647";
  toast.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  toast.style.display = "flex";
  toast.style.flexDirection = "column";
  toast.style.gap = "12px";

  const heading = document.createElement("div");
  heading.style.display = "flex";
  heading.style.justifyContent = "space-between";
  heading.style.alignItems = "center";

  const title = document.createElement("strong");
  title.textContent = match ? "Description matched" : "Add job description";
  title.style.fontSize = "15px";
  title.style.fontWeight = "600";

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "×";
  dismiss.style.background = "transparent";
  dismiss.style.border = "none";
  dismiss.style.color = "white";
  dismiss.style.fontSize = "18px";
  dismiss.style.cursor = "pointer";

  heading.appendChild(title);
  heading.appendChild(dismiss);

  const message = document.createElement("p");
  message.style.margin = "0";
  message.style.fontSize = "13px";
  message.style.lineHeight = "1.5";
  message.style.color = "rgba(255,255,255,0.82)";
  if (match) {
    const companyPart = match.company ? ` · ${match.company}` : "";
    message.textContent = `Matched to ${match.title ?? "Saved description"}${companyPart} (${match.collectionName}).`;
  } else {
    message.textContent = "No description is linked to this autofill yet.";
  }

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.flexWrap = "wrap";

  function createAction(label: string, tone: "primary" | "secondary" | "ghost" = "secondary") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.borderRadius = "9999px";
    button.style.padding = "6px 14px";
    button.style.fontSize = "13px";
    button.style.fontWeight = "600";
    button.style.cursor = "pointer";
    button.style.border = "1px solid transparent";
    switch (tone) {
      case "primary":
        button.style.background = "white";
        button.style.color = "#1f2937";
        break;
      case "secondary":
        button.style.background = "rgba(148, 163, 184, 0.15)";
        button.style.borderColor = "rgba(148, 163, 184, 0.4)";
        button.style.color = "white";
        break;
      case "ghost":
      default:
        button.style.background = "transparent";
        button.style.color = "rgba(255,255,255,0.82)";
        break;
    }
    return button;
  }

  const changeButton = createAction(match ? "Change" : "Set description", "primary");
  const saveButton = createAction("Save new", "secondary");
  const confirmButton = match ? createAction("Confirm", "secondary") : null;

  const buttons = [changeButton, saveButton];
  if (confirmButton) {
    buttons.unshift(confirmButton);
  }

  buttons.forEach((button) => actions.appendChild(button));

  toast.appendChild(heading);
  toast.appendChild(message);
  toast.appendChild(actions);
  document.body.appendChild(toast);
  activeHistoryToast = toast;

  let busy = false;
  function withBusy<T>(fn: () => Promise<T>): () => Promise<void> {
    return async () => {
      if (busy) return;
      busy = true;
      buttons.forEach((button) => {
        button.disabled = true;
        button.style.opacity = "0.7";
        button.style.cursor = "wait";
      });
      try {
        await fn();
      } finally {
        busy = false;
        buttons.forEach((button) => {
          button.disabled = false;
          button.style.opacity = "1";
          button.style.cursor = "pointer";
        });
      }
    };
  }

  if (confirmButton && match) {
    confirmButton.addEventListener(
      "click",
      withBusy(async () => {
        try {
          await handleLink(historyId, match.itemId);
          notify("Job description linked.");
          dismissActiveToast();
        } catch (error) {
          console.error("JobSnap link confirm failed", error);
          notify("Failed to link description.", true);
        }
      })
    );
  }

  changeButton.addEventListener(
    "click",
    withBusy(async () => {
      const selection = await openHistoryLinkDialog(host);
      if (!selection) {
        return;
      }
      try {
        await handleLink(historyId, selection.itemId);
        notify(`Linked to ${selection.title ?? "saved description"}.`);
        dismissActiveToast();
      } catch (error) {
        console.error("JobSnap change link failed", error);
        notify("Failed to link description.", true);
      }
    })
  );

  saveButton.addEventListener(
    "click",
    withBusy(async () => {
      const savedId = await saveCurrentJobToCollections();
      if (!savedId) {
        notify("Save cancelled.");
        return;
      }
      try {
        const linked = await handleLink(historyId, savedId);
        notify(`Saved and linked${linked?.title ? ` to ${linked.title}` : ""}.`);
        dismissActiveToast();
      } catch (error) {
        console.error("JobSnap save-and-link failed", error);
        notify("Failed to link description.", true);
      }
    })
  );

  dismiss.addEventListener("click", () => dismissActiveToast());
}

function dismissActiveToast() {
  if (activeHistoryToast) {
    activeHistoryToast.remove();
    activeHistoryToast = null;
  }
}

async function handleLink(historyId: string, jdItemId: string | null) {
  const response = await sendMessage<{ title?: string; company?: string } | null>({
    type: "HISTORY_LINK_JD",
    historyId,
    jdItemId
  });
  return response ?? undefined;
}

function notify(message: string, error = false) {
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
  toast.style.boxShadow = "0 10px 24px rgba(15, 118, 110, 0.35)";
  toast.style.zIndex = "2147483647";
  toast.style.fontSize = "13px";
  toast.style.fontWeight = "600";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

async function openHistoryLinkDialog(host: string): Promise<HistoryMatchInfo | null> {
  const existing = document.getElementById("jobsnap-history-dialog");
  if (existing) {
    existing.remove();
  }

  return new Promise<HistoryMatchInfo | null>((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "jobsnap-history-dialog";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(15, 23, 42, 0.55)";
    overlay.style.backdropFilter = "blur(2px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "24px";
    overlay.style.zIndex = "2147483646";

    const dialog = document.createElement("div");
    dialog.style.width = "100%";
    dialog.style.maxWidth = "520px";
    dialog.style.background = "white";
    dialog.style.borderRadius = "16px";
    dialog.style.boxShadow = "0 24px 48px rgba(15, 23, 42, 0.35)";
    dialog.style.padding = "24px";
    dialog.style.display = "flex";
    dialog.style.flexDirection = "column";
    dialog.style.gap = "20px";
    dialog.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const heading = document.createElement("div");
    heading.style.display = "flex";
    heading.style.justifyContent = "space-between";
    heading.style.alignItems = "center";

    const title = document.createElement("h2");
    title.textContent = "Link job description";
    title.style.margin = "0";
    title.style.fontSize = "18px";
    title.style.fontWeight = "600";
    title.style.color = "#0f172a";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.style.background = "transparent";
    closeButton.style.border = "none";
    closeButton.style.fontSize = "20px";
    closeButton.style.cursor = "pointer";
    closeButton.style.color = "#475569";

    heading.appendChild(title);
    heading.appendChild(closeButton);

    const description = document.createElement("p");
    description.textContent = "Choose from saved descriptions on this site.";
    description.style.margin = "0";
    description.style.fontSize = "13px";
    description.style.color = "#475569";

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search title, company, tags";
    search.style.width = "100%";
    search.style.padding = "10px 12px";
    search.style.borderRadius = "12px";
    search.style.border = "1px solid #cbd5e1";
    search.style.fontSize = "14px";

    const list = document.createElement("div");
    list.style.maxHeight = "320px";
    list.style.overflowY = "auto";
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "10px";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.style.background = "transparent";
    cancelButton.style.border = "none";
    cancelButton.style.fontSize = "14px";
    cancelButton.style.fontWeight = "500";
    cancelButton.style.color = "#475569";
    cancelButton.style.cursor = "pointer";

    footer.appendChild(cancelButton);

    dialog.appendChild(heading);
    dialog.appendChild(description);
    dialog.appendChild(search);
    dialog.appendChild(list);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    search.focus();

    let records: HistoryMatchInfo[] = [];
    let filter = "";

    function cleanup(result: HistoryMatchInfo | null) {
      overlay.remove();
      resolve(result);
    }

    closeButton.addEventListener("click", () => cleanup(null));
    cancelButton.addEventListener("click", () => cleanup(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup(null);
      }
    });

    const loading = document.createElement("p");
    loading.textContent = "Loading…";
    loading.style.margin = "0";
    loading.style.fontSize = "13px";
    loading.style.color = "#64748b";
    list.appendChild(loading);

    sendMessage<HostGroup[]>({ type: "JD_LIST_BY_HOST", host })
      .then((groups) => {
        records = (groups ?? []).flatMap((group) =>
          group.items.map((item) => ({
            itemId: item.id,
            collectionId: group.collectionId,
            collectionName: group.collectionName,
            title: item.title,
            company: item.company,
            tier: "manual",
            score: 1
          }))
        );
        render();
      })
      .catch((error) => {
        console.error("JobSnap JD_LIST_BY_HOST failed", error);
        list.innerHTML = "";
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "Unable to load saved descriptions.";
        errorMessage.style.margin = "0";
        errorMessage.style.fontSize = "13px";
        errorMessage.style.color = "#b91c1c";
        list.appendChild(errorMessage);
      });

    search.addEventListener("input", () => {
      filter = search.value.trim().toLowerCase();
      render();
    });

    function render() {
      list.innerHTML = "";
      if (!records.length) {
        const empty = document.createElement("p");
        empty.textContent = "No saved descriptions yet.";
        empty.style.margin = "0";
        empty.style.fontSize = "13px";
        empty.style.color = "#64748b";
        list.appendChild(empty);
        return;
      }

      const filtered = records.filter((record) => {
        if (!filter) return true;
        const haystack = [record.title, record.company, record.collectionName]
          .filter(Boolean)
          .map((value) => value!.toLowerCase())
          .join(" ");
        return haystack.includes(filter);
      });

      if (!filtered.length) {
        const none = document.createElement("p");
        none.textContent = "No descriptions match the search.";
        none.style.margin = "0";
        none.style.fontSize = "13px";
        none.style.color = "#64748b";
        list.appendChild(none);
        return;
      }

      filtered.forEach((record) => {
        const option = document.createElement("button");
        option.type = "button";
        option.style.display = "flex";
        option.style.flexDirection = "column";
        option.style.alignItems = "flex-start";
        option.style.gap = "4px";
        option.style.width = "100%";
        option.style.padding = "10px 12px";
        option.style.borderRadius = "12px";
        option.style.border = "1px solid #e2e8f0";
        option.style.background = "white";
        option.style.cursor = "pointer";
        option.addEventListener("mouseenter", () => {
          option.style.borderColor = "#cbd5f5";
          option.style.background = "#eef2ff";
        });
        option.addEventListener("mouseleave", () => {
          option.style.borderColor = "#e2e8f0";
          option.style.background = "white";
        });

        const titleLine = document.createElement("span");
        titleLine.textContent = record.title ?? "Untitled position";
        titleLine.style.fontSize = "14px";
        titleLine.style.fontWeight = "600";
        titleLine.style.color = "#0f172a";

        const metaLine = document.createElement("span");
        const companyPart = record.company ? ` · ${record.company}` : "";
        metaLine.textContent = `${record.collectionName}${companyPart}`;
        metaLine.style.fontSize = "12px";
        metaLine.style.color = "#64748b";

        option.appendChild(titleLine);
        option.appendChild(metaLine);
        option.addEventListener("click", () => {
          cleanup(record);
        });

        list.appendChild(option);
      });
    }
  });
}
