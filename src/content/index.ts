import type { Msg } from "../ui-shared/messaging";
import { fillActiveProfile } from "./runtime";
import { getJobContext, initJobDetection, saveCurrentJobToCollections, type JobContext } from "./jobs-detect";

const FAB_CONTAINER_ID = "jobsnap-fab";

interface FabAction {
  id: string;
  title: string;
  icon: string; // Unicode character
  isAvailable: () => boolean;
  onClick: () => Promise<void> | void;
}

let jobContext: JobContext | null = null;
let formAvailable = hasFillableInputs();
let isLinkedInProfile = checkIsLinkedInProfile();
let menuOpen = false;

console.log('JobSnap: Initial state', {
  formAvailable,
  isLinkedInProfile,
  jobContext: !!jobContext,
  hostname: window.location.hostname,
  pathname: window.location.pathname
});

let container: HTMLDivElement | null = null;
let actionsList: HTMLDivElement | null = null;
let mainButton: HTMLButtonElement | null = null;
let fabUpdateTimeout: number | null = null;
let shadowHost: HTMLDivElement | null = null;
let menuContainer: HTMLDivElement | null = null;
let handleWrapper: HTMLDivElement | null = null;

const actions: FabAction[] = [
  {
    id: "autofill",
    title: "Autofill form",
    icon: "✨", // Magic wand
    isAvailable: () => formAvailable,
    onClick: async () => {
      closeMenu();
      try {
        await fillActiveProfile();
        showToast("Autofill complete.");
      } catch (error) {
        console.error("JobSnap autofill failed", error);
        showToast("Autofill failed", true);
      }
    }
  },
  {
    id: "save-jd",
    title: "Save job",
    icon: "📑", // Bookmark/document
    isAvailable: () => Boolean(jobContext?.text),
    onClick: async () => {
      if (!jobContext?.text) return;
      closeMenu();
      try {
        const savedId = await saveCurrentJobToCollections();
        if (savedId) {
          showToast("Job saved.");
        }
      } catch (error) {
        console.error("JobSnap save failed", error);
        showToast("Unable to save job", true);
      }
    }
  },
  {
    id: "mark-applied",
    title: "Mark applied",
    icon: "✓", // Check mark
    isAvailable: () => Boolean(jobContext),
    onClick: async () => {
      if (!jobContext) return;
      closeMenu();
      try {
        await sendRuntimeMessage({
          type: "HISTORY_LOG_AUTOFILL",
          payload: {
            host: jobContext.host,
            url: jobContext.url,
            title: jobContext.title ?? document.title,
            company: jobContext.company,
            status: "applied"
          }
        });
        showToast("Marked as applied.");
      } catch (error) {
        console.error("JobSnap history log failed", error);
        showToast("Unable to mark applied", true);
      }
    }
  },
  {
    id: "import-linkedin",
    title: "Import LinkedIn profile",
    icon: "👤", // User silhouette
    isAvailable: () => isLinkedInProfile,
    onClick: async () => {
      closeMenu();
      try {
        const result = await sendRuntimeMessage({ type: "IMPORT_FROM_LINKEDIN" });
        if (result) {
          showToast("LinkedIn profile imported successfully!");
        } else {
          showToast("Failed to import LinkedIn profile", true);
        }
      } catch (error) {
        console.error("JobSnap LinkedIn import failed", error);
        showToast(error instanceof Error ? error.message : "Failed to import LinkedIn profile", true);
      }
    }
  }
];

const actionButtons = new Map<string, HTMLButtonElement>();
let lastFabState = '';

initFab();
const disposeJobDetection = initJobDetection((context) => {
  jobContext = context;
  scheduleFabStateUpdate();
});

const formObserver = new MutationObserver(() => {
  const next = hasFillableInputs();
  if (next !== formAvailable) {
    formAvailable = next;
    scheduleFabStateUpdate();
  }
});

// LinkedIn profile detection observer with debouncing
let linkedinCheckTimeout: number | null = null;
const linkedinObserver = new MutationObserver(() => {
  // Debounce the LinkedIn profile check to avoid spam
  if (linkedinCheckTimeout !== null) {
    clearTimeout(linkedinCheckTimeout);
  }

  linkedinCheckTimeout = window.setTimeout(() => {
    const next = checkIsLinkedInProfile();
    if (next !== isLinkedInProfile) {
      console.log('JobSnap: LinkedIn profile state changed', { was: isLinkedInProfile, now: next });
      isLinkedInProfile = next;
      scheduleFabStateUpdate();
    }
  }, 500); // Debounce for 500ms
});

const formObserverTarget = document.getElementById("main") ?? document.body;
if (formObserverTarget) {
  formObserver.observe(formObserverTarget, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "style", "aria-hidden", "class"]
  });

  // Also observe for LinkedIn profile changes
  linkedinObserver.observe(formObserverTarget, {
    childList: true,
    subtree: true
  });
}

window.addEventListener("beforeunload", () => {
  formObserver.disconnect();
  linkedinObserver.disconnect();
  disposeJobDetection?.();
});

document.addEventListener(
  "click",
  (event) => {
    if (!menuOpen || !shadowHost) return;
    const target = event.target as Node | null;
    if (target && shadowHost.contains(target)) {
      return;
    }
    closeMenu();
  },
  true
);

// Track if we've already shown the prompt to prevent duplicates
let applicationPromptShown = false;
let applicationPromptTimeout: number | null = null;

// Detect form submission and prompt for application confirmation
document.addEventListener(
  "click",
  async (event) => {
    const target = event.target as HTMLElement;

    // Ignore clicks from within our shadow DOM or JobSnap dialogs
    if (shadowHost && shadowHost.contains(target)) return;
    if (target.closest("#jobsnap-collection-dialog")) return;

    // Check if the clicked element is a submit/apply button
    const isSubmitButton =
      target instanceof HTMLButtonElement &&
      (target.type === "submit" ||
       /apply|submit|send/i.test(target.textContent || "") ||
       /apply|submit|send/i.test(target.getAttribute("aria-label") || ""));

    // Also check if it's a link that looks like a submit action
    const isSubmitLink =
      target instanceof HTMLAnchorElement &&
      /apply|submit/i.test(target.textContent || "");

    if ((isSubmitButton || isSubmitLink) && formAvailable && jobContext && !applicationPromptShown) {
      // Mark as shown and wait a moment for form to submit, then show prompt
      applicationPromptShown = true;
      if (applicationPromptTimeout) clearTimeout(applicationPromptTimeout);

      applicationPromptTimeout = window.setTimeout(() => {
        showApplicationPrompt();
        // Reset after 30 seconds to allow another prompt on a new application
        setTimeout(() => {
          applicationPromptShown = false;
        }, 30000);
      }, 500);
    }
  },
  true
);

// Additional delayed check for LinkedIn since it loads content dynamically
if (window.location.hostname.includes('linkedin.com')) {
  setTimeout(() => {
    const wasLinkedInProfile = isLinkedInProfile;
    isLinkedInProfile = checkIsLinkedInProfile();
    if (wasLinkedInProfile !== isLinkedInProfile) {
      console.log('JobSnap: LinkedIn profile state changed on delayed check', { was: wasLinkedInProfile, now: isLinkedInProfile });
      scheduleFabStateUpdate();
    }
  }, 2000); // Check again after 2 seconds

  setTimeout(() => {
    const wasLinkedInProfile = isLinkedInProfile;
    isLinkedInProfile = checkIsLinkedInProfile();
    if (wasLinkedInProfile !== isLinkedInProfile) {
      console.log('JobSnap: LinkedIn profile state changed on delayed check', { was: wasLinkedInProfile, now: isLinkedInProfile });
      scheduleFabStateUpdate();
    }
  }, 5000); // Check again after 5 seconds
}

function initFab() {
  ensureFabElements();
  updateFabState();
}

function ensureFabElements() {
  if (container) return;

  // Create shadow host
  shadowHost = document.createElement("div");
  shadowHost.id = FAB_CONTAINER_ID;

  // Create shadow root for CSS isolation
  const shadowRoot = shadowHost.attachShadow({ mode: "open" });

  // Add scoped styles for shadow DOM
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      display: block;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  `;
  shadowRoot.appendChild(style);

  container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "120px";
  container.style.right = "0px";
  container.style.zIndex = "2147483647";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.userSelect = "none";
  container.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  container.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

  // Make container draggable
  let isDragging = false;
  let startY = 0;
  let initialTop = 0;

  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Only allow dragging from the drag handle
    if (!target.classList.contains('jobsnap-drag-handle') && !target.closest('.jobsnap-drag-handle')) {
      return;
    }
    isDragging = true;
    startY = e.clientY;
    initialTop = parseInt(container!.style.top || "120");
    container!.style.transition = "none";
    container!.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    const deltaY = e.clientY - startY;
    const newTop = initialTop + deltaY;

    // Keep within viewport bounds
    const maxTop = window.innerHeight - 80;
    container!.style.top = Math.max(20, Math.min(newTop, maxTop)) + "px";
  };

  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      container!.style.cursor = "";
      container!.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    }
  };

  container.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  // Create handle wrapper
  handleWrapper = document.createElement("div");
  handleWrapper.style.display = "flex";
  handleWrapper.style.alignItems = "center";
  handleWrapper.style.backgroundColor = "#ffffff";
  handleWrapper.style.boxShadow = "0 0 40px 0 rgba(255, 180, 180, 0.25)";
  handleWrapper.style.borderRadius = "8px 0 0 8px";
  handleWrapper.style.position = "relative";
  handleWrapper.style.overflow = "visible"; // Allow close button to extend beyond bounds

  // Create button container
  const buttonContainer = document.createElement("div");
  buttonContainer.style.position = "relative";
  buttonContainer.style.display = "flex";
  buttonContainer.style.alignItems = "center";
  buttonContainer.style.justifyContent = "center";
  buttonContainer.style.width = "48px";
  buttonContainer.style.height = "48px";
  buttonContainer.style.overflow = "visible"; // Allow close button to hang over edge

  // Create main button
  mainButton = document.createElement("button");
  mainButton.type = "button";
  mainButton.style.width = "48px";
  mainButton.style.height = "48px";
  mainButton.style.border = "none";
  mainButton.style.background = "transparent";
  mainButton.style.cursor = "pointer";
  mainButton.style.padding = "0";
  mainButton.style.display = "flex";
  mainButton.style.alignItems = "center";
  mainButton.style.justifyContent = "center";
  mainButton.style.position = "relative";
  mainButton.title = "JobSnap actions";
  mainButton.setAttribute("aria-label", "JobSnap actions");

  const iconUrl = chrome.runtime.getURL("fullsize.png");
  const icon = document.createElement("img");
  icon.src = iconUrl;
  icon.alt = "JobSnap";
  icon.style.width = "48px";
  icon.style.height = "48px";
  icon.style.borderRadius = "8px";
  icon.style.pointerEvents = "none";
  icon.style.objectFit = "contain";
  mainButton.appendChild(icon);

  // Create close button (X) - small circular button
  const closeButton = document.createElement("div");
  closeButton.style.position = "absolute";
  closeButton.style.top = "-6px";
  closeButton.style.left = "-6px";
  closeButton.style.width = "18px";
  closeButton.style.height = "18px";
  closeButton.style.borderRadius = "50%";
  closeButton.style.background = "#ffffff";
  closeButton.style.border = "1px solid #e2e8f0";
  closeButton.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
  closeButton.style.cursor = "pointer";
  closeButton.style.opacity = "0";
  closeButton.style.transition = "opacity 0.2s ease, transform 0.2s ease";
  closeButton.style.pointerEvents = "none";
  closeButton.style.color = "#64748b";
  closeButton.style.fontSize = "11px";
  closeButton.style.fontWeight = "bold";
  closeButton.style.display = "flex";
  closeButton.style.alignItems = "center";
  closeButton.style.justifyContent = "center";
  closeButton.textContent = "✕";

  // Add hover effect to close button
  closeButton.addEventListener("mouseenter", () => {
    closeButton.style.transform = "scale(1.15)";
    closeButton.style.background = "#fee2e2";
    closeButton.style.borderColor = "#fca5a5";
    closeButton.style.color = "#dc2626";
  });
  closeButton.addEventListener("mouseleave", () => {
    closeButton.style.transform = "scale(1)";
    closeButton.style.background = "#ffffff";
    closeButton.style.borderColor = "#e2e8f0";
    closeButton.style.color = "#64748b";
  });

  buttonContainer.appendChild(mainButton);
  buttonContainer.appendChild(closeButton);

  // Create drag handle
  const dragHandle = document.createElement("div");
  dragHandle.className = "jobsnap-drag-handle";
  dragHandle.style.display = "flex";
  dragHandle.style.alignItems = "center";
  dragHandle.style.justifyContent = "center";
  dragHandle.style.flexDirection = "column";
  dragHandle.style.background = "linear-gradient(135deg, #FFB5B5 0%, #B5E7DD 100%)";
  dragHandle.style.height = "64px";
  dragHandle.style.width = "0px";
  dragHandle.style.paddingInline = "0px";
  dragHandle.style.gap = "8px";
  dragHandle.style.cursor = "grab";
  dragHandle.style.transition = "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease";
  dragHandle.style.overflow = "hidden";
  dragHandle.style.whiteSpace = "nowrap";
  dragHandle.style.opacity = "0";
  dragHandle.style.color = "white";
  dragHandle.style.fontSize = "14px";
  dragHandle.style.fontWeight = "bold";
  dragHandle.textContent = "⋮⋮"; // Vertical dots

  // Hover effect to show drag handle
  let hoverTimeout: number | null = null;
  container.addEventListener("mouseenter", () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    dragHandle.style.width = "24px";
    dragHandle.style.paddingInline = "4px";
    dragHandle.style.opacity = "1";
    closeButton.style.opacity = "1";
    closeButton.style.pointerEvents = "auto";
  });

  container.addEventListener("mouseleave", () => {
    hoverTimeout = window.setTimeout(() => {
      if (!isDragging) {
        dragHandle.style.width = "0px";
        dragHandle.style.paddingInline = "0px";
        dragHandle.style.opacity = "0";
        closeButton.style.opacity = "0";
        closeButton.style.pointerEvents = "none";
      }
    }, 300);
  });

  // Click handler for main button
  mainButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("JobSnap: FAB main button clicked", { menuOpen });
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Click handler for close button
  closeButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (shadowHost && shadowHost.parentElement) {
      shadowHost.style.display = "none";
    }
  });

  handleWrapper.appendChild(buttonContainer);
  handleWrapper.appendChild(dragHandle);

  // Create menu container
  menuContainer = document.createElement("div");
  menuContainer.style.position = "absolute";
  menuContainer.style.right = "0px"; // Touch the right edge of screen
  menuContainer.style.top = "0";
  menuContainer.style.transform = "translateX(400px)";
  menuContainer.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
  menuContainer.style.pointerEvents = "none";

  // Create actions list (will be populated later)
  actionsList = document.createElement("div");
  actionsList.style.display = "flex";
  actionsList.style.flexDirection = "column";
  actionsList.style.gap = "6px";
  actionsList.style.padding = "12px";
  actionsList.style.paddingTop = "12px";
  actionsList.style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%)";
  actionsList.style.borderRadius = "12px";
  actionsList.style.boxShadow = "0 8px 32px rgba(255, 180, 180, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)";
  actionsList.style.backdropFilter = "blur(12px)";
  actionsList.style.minWidth = "180px";
  actionsList.style.border = "1px solid rgba(255, 180, 180, 0.2)";
  actionsList.style.position = "relative";

  // Create floating X button for menu (top-left corner)
  const menuCloseButton = document.createElement("button");
  menuCloseButton.type = "button";
  menuCloseButton.style.position = "absolute";
  menuCloseButton.style.top = "-12px";
  menuCloseButton.style.left = "-12px";
  menuCloseButton.style.width = "32px";
  menuCloseButton.style.height = "32px";
  menuCloseButton.style.borderRadius = "50%";
  menuCloseButton.style.border = "2px solid #ffffff";
  menuCloseButton.style.background = "linear-gradient(135deg, #FFB5B5 0%, #D4C5F9 100%)";
  menuCloseButton.style.color = "white";
  menuCloseButton.style.cursor = "pointer";
  menuCloseButton.style.display = "flex";
  menuCloseButton.style.alignItems = "center";
  menuCloseButton.style.justifyContent = "center";
  menuCloseButton.style.boxShadow = "0 4px 12px rgba(255, 180, 180, 0.4)";
  menuCloseButton.style.transition = "all 0.2s ease";
  menuCloseButton.style.fontSize = "16px";
  menuCloseButton.style.fontWeight = "bold";
  menuCloseButton.textContent = "✕";

  menuCloseButton.addEventListener("mouseenter", () => {
    menuCloseButton.style.transform = "scale(1.1) rotate(90deg)";
    menuCloseButton.style.boxShadow = "0 6px 16px rgba(255, 180, 180, 0.5)";
  });
  menuCloseButton.addEventListener("mouseleave", () => {
    menuCloseButton.style.transform = "scale(1) rotate(0deg)";
    menuCloseButton.style.boxShadow = "0 4px 12px rgba(255, 180, 180, 0.4)";
  });
  menuCloseButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
  });

  actionsList.appendChild(menuCloseButton);
  menuContainer.appendChild(actionsList);

  container.appendChild(menuContainer);
  container.appendChild(handleWrapper);

  shadowRoot.appendChild(container);

  const attach = () => {
    if (document.body) {
      document.body.appendChild(shadowHost);
    } else {
      requestAnimationFrame(attach);
    }
  };
  attach();
}

// Ensure a follow-up check once the current task queue clears so late DOM mutations don't hide the FAB.
scheduleFabStateUpdate();

function updateFabState() {
  if (!container) return;

  const available = actions.filter((action) => action.isAvailable());
  const currentState = `${available.length}-${formAvailable}-${isLinkedInProfile}-${!!jobContext}`;

  if (currentState !== lastFabState) {
    console.log('JobSnap: FAB state changed', {
      totalActions: actions.length,
      availableActions: available.map(a => a.id),
      formAvailable,
      isLinkedInProfile,
      jobContext: !!jobContext
    });
    lastFabState = currentState;
  }

  if (!available.length) {
    container.style.display = "none";
    closeMenu();
    return;
  }

  container.style.display = "flex";

  // Clear and repopulate actions (keep the close button)
  while (actionsList!.children.length > 1) {
    actionsList!.removeChild(actionsList!.lastChild!);
  }

  for (const action of available) {
    let button = actionButtons.get(action.id);
    if (!button) {
      button = createActionButton(action);
      actionButtons.set(action.id, button);
    }
    actionsList!.appendChild(button);
  }
}

function scheduleFabStateUpdate() {
  if (fabUpdateTimeout !== null) return;
  fabUpdateTimeout = window.setTimeout(() => {
    fabUpdateTimeout = null;
    updateFabState();
  }, 50);
}

function openMenu() {
  if (!menuContainer || !handleWrapper) return;
  const available = actions.filter((action) => action.isAvailable());
  console.log('JobSnap: Opening menu', {
    totalActions: actions.length,
    availableActions: available.map(a => a.id)
  });
  if (!available.length) {
    console.log('JobSnap: No available actions to show');
    return;
  }
  menuOpen = true;

  // Hide main button and drag handle
  handleWrapper.style.opacity = "0";
  handleWrapper.style.pointerEvents = "none";
  handleWrapper.style.transition = "opacity 0.2s ease";

  // Slide menu in from right
  setTimeout(() => {
    menuContainer!.style.transform = "translateX(0)";
    menuContainer!.style.pointerEvents = "auto";
  }, 100);

  console.log('JobSnap: Menu opened');
}

function closeMenu() {
  if (!menuContainer || !handleWrapper) return;
  menuOpen = false;

  // Slide menu out to right
  menuContainer.style.transform = "translateX(400px)";
  menuContainer.style.pointerEvents = "none";

  // Show main button and drag handle after animation
  setTimeout(() => {
    handleWrapper.style.opacity = "1";
    handleWrapper.style.pointerEvents = "auto";
  }, 200);
}

function createActionButton(action: FabAction): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.style.width = "100%";
  button.style.padding = "10px 12px";
  button.style.borderRadius = "8px";
  button.style.border = "2px solid rgba(255, 180, 180, 0.15)";
  button.style.background = "rgba(255, 255, 255, 0.8)";
  button.style.color = "#1e293b";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.gap = "10px";
  button.style.cursor = "pointer";
  button.style.transition = "all 0.2s ease";
  button.style.fontSize = "13px";
  button.style.fontWeight = "600";
  button.style.textAlign = "left";

  button.title = action.title;
  button.setAttribute("aria-label", action.title);

  // Add icon
  const iconContainer = document.createElement("div");
  iconContainer.style.width = "18px";
  iconContainer.style.height = "18px";
  iconContainer.style.flexShrink = "0";
  iconContainer.style.transition = "transform 0.2s ease";
  iconContainer.style.display = "flex";
  iconContainer.style.alignItems = "center";
  iconContainer.style.justifyContent = "center";
  iconContainer.style.fontSize = "16px";
  iconContainer.textContent = action.icon;
  button.appendChild(iconContainer);

  const label = document.createElement("span");
  label.textContent = action.title;
  button.appendChild(label);

  button.addEventListener("mouseenter", () => {
    button.style.background = "linear-gradient(135deg, rgba(255, 180, 180, 0.1) 0%, rgba(181, 231, 221, 0.1) 100%)";
    button.style.borderColor = "rgba(255, 180, 180, 0.3)";
    button.style.transform = "translateX(-2px)";
    iconContainer.style.transform = "scale(1.1)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.background = "rgba(255, 255, 255, 0.8)";
    button.style.borderColor = "rgba(255, 180, 180, 0.15)";
    button.style.transform = "translateX(0)";
    iconContainer.style.transform = "scale(1)";
  });
  button.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("JobSnap: FAB action clicked", action.id);
    await action.onClick();
  });

  return button;
}

function hasFillableInputs(): boolean {
  const selector = [
    "input:not([type='hidden']):not([hidden]):not([aria-hidden='true'])",
    "textarea:not([hidden]):not([aria-hidden='true'])",
    "select:not([hidden]):not([aria-hidden='true'])"
  ].join(",");

  if (document.querySelector(selector)) {
    return true;
  }

  for (const form of document.querySelectorAll("form")) {
    if (form.querySelector(selector)) {
      return true;
    }
  }
  return false;
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
  toast.style.zIndex = "2147483647";
  toast.style.fontSize = "13px";
  toast.style.fontWeight = "600";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function showApplicationPrompt() {
  if (!jobContext) return;

  const prompt = document.createElement("div");
  prompt.style.position = "fixed";
  prompt.style.bottom = "24px";
  prompt.style.right = "24px";
  prompt.style.background = "white";
  prompt.style.color = "#1e293b";
  prompt.style.padding = "16px";
  prompt.style.borderRadius = "12px";
  prompt.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.2)";
  prompt.style.zIndex = "2147483647";
  prompt.style.fontSize = "14px";
  prompt.style.fontWeight = "500";
  prompt.style.width = "280px";
  prompt.style.fontFamily = "system-ui, -apple-system, sans-serif";

  const message = document.createElement("div");
  message.textContent = "Did you apply to this job?";
  message.style.marginBottom = "12px";
  message.style.fontWeight = "600";

  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "8px";

  const yesButton = document.createElement("button");
  yesButton.textContent = "Yes";
  yesButton.style.flex = "1";
  yesButton.style.padding = "8px 16px";
  yesButton.style.background = "#0f766e";
  yesButton.style.color = "white";
  yesButton.style.border = "none";
  yesButton.style.borderRadius = "6px";
  yesButton.style.cursor = "pointer";
  yesButton.style.fontSize = "13px";
  yesButton.style.fontWeight = "600";
  yesButton.style.transition = "background 0.2s";

  const noButton = document.createElement("button");
  noButton.textContent = "No";
  noButton.style.flex = "1";
  noButton.style.padding = "8px 16px";
  noButton.style.background = "#e2e8f0";
  noButton.style.color = "#475569";
  noButton.style.border = "none";
  noButton.style.borderRadius = "6px";
  noButton.style.cursor = "pointer";
  noButton.style.fontSize = "13px";
  noButton.style.fontWeight = "600";
  noButton.style.transition = "background 0.2s";

  yesButton.addEventListener("mouseenter", () => {
    yesButton.style.background = "#0d9488";
  });
  yesButton.addEventListener("mouseleave", () => {
    yesButton.style.background = "#0f766e";
  });

  noButton.addEventListener("mouseenter", () => {
    noButton.style.background = "#cbd5e1";
  });
  noButton.addEventListener("mouseleave", () => {
    noButton.style.background = "#e2e8f0";
  });

  yesButton.addEventListener("click", async () => {
    try {
      await sendRuntimeMessage({
        type: "HISTORY_LOG_AUTOFILL",
        payload: {
          host: jobContext!.host,
          url: jobContext!.url,
          title: jobContext!.title ?? document.title,
          company: jobContext!.company,
          status: "applied"
        }
      });
      prompt.remove();
      showToast("Marked as applied!");
    } catch (error) {
      console.error("JobSnap: Failed to mark as applied", error);
      prompt.remove();
      showToast("Failed to mark as applied", true);
    }
  });

  noButton.addEventListener("click", () => {
    prompt.remove();
  });

  buttonContainer.appendChild(yesButton);
  buttonContainer.appendChild(noButton);
  prompt.appendChild(message);
  prompt.appendChild(buttonContainer);
  document.body.appendChild(prompt);

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (prompt.parentElement) {
      prompt.remove();
    }
  }, 10000);
}

function checkIsLinkedInProfile(): boolean {
  // Check if we're on LinkedIn
  if (!window.location.hostname.includes('linkedin.com')) {
    return false;
  }

  // Check if we're on a profile page
  if (!window.location.pathname.includes('/in/')) {
    return false;
  }

  // Additional checks to ensure it's a valid profile page
  // Look for profile-specific elements
  const profileIndicators = [
    '.pv-text-details__left-panel', // Profile header section
    '.pv-top-card', // Profile top card
    '[data-section="topCard"]', // Profile top card (newer layout)
    '.profile-detail', // Profile detail section
    '.pv-profile-section', // Any profile section
    '.artdeco-card.pv-profile-section', // Profile sections
    // More modern LinkedIn selectors
    '.pv-top-card-profile-picture', // Profile picture
    '.text-heading-xlarge', // Name heading
    '.pv-shared-text-with-see-more', // About section
    '.pvs-header', // Section headers
    '.pvs-list', // Section lists
    // Fallback - if URL looks like profile, assume it is
    'main[role="main"]' // Main content area
  ];

  const foundElements = profileIndicators.filter(selector => document.querySelector(selector));

  // More lenient check - if we're on LinkedIn profile URL, likely a profile
  const urlBasedCheck = window.location.pathname.match(/^\/in\/[^\/]+\/?$/);
  const result = foundElements.length > 0 || !!urlBasedCheck;

  return result;
}

function sendRuntimeMessage<T = unknown>(message: Msg): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      reject(new Error("Chrome runtime not available. Extension may not be properly loaded."));
      return;
    }

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
        resolve(response.data as T);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}
