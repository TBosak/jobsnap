import type { JobAdapter, JobPageExtract } from "./types";

// Track if we've shown the notification for this page load
let workdayNotificationShown = false;

function showWorkdayNotification(listingUrl: string) {
  // Only show once per page load
  if (workdayNotificationShown) {
    return;
  }

  // Check if notification already exists
  if (document.getElementById('jobsnap-workday-notice')) {
    return;
  }

  workdayNotificationShown = true;

  const notice = document.createElement('div');
  notice.id = 'jobsnap-workday-notice';
  notice.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    animation: slideIn 0.3s ease-out;
  `;

  const dismissButton = document.createElement('button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    color: white;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 13px;
    transition: background 0.2s;
  `;
  dismissButton.onmouseover = () => dismissButton.style.background = 'rgba(255, 255, 255, 0.3)';
  dismissButton.onmouseout = () => dismissButton.style.background = 'rgba(255, 255, 255, 0.2)';
  dismissButton.onclick = () => {
    notice.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notice.remove(), 300);
  };

  notice.innerHTML = `
    <style>
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    </style>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <div style="font-size: 24px;">💡</div>
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 8px;">Visit Job Listing First</div>
        <div style="opacity: 0.95; margin-bottom: 12px;">
          To save the full job description, please visit the job listing page before applying.
        </div>
        <div style="display: flex; gap: 8px;" id="jobsnap-workday-notice-buttons">
          <a href="${listingUrl}" target="_blank" style="
            background: white;
            color: #667eea;
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            font-size: 13px;
            transition: transform 0.2s;
            display: inline-block;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            Open Listing
          </a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(notice);

  // Add dismiss button
  const buttonsContainer = notice.querySelector('#jobsnap-workday-notice-buttons');
  if (buttonsContainer) {
    buttonsContainer.appendChild(dismissButton);
  }

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (notice.parentElement) {
      notice.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notice.remove(), 300);
    }
  }, 10000);
}

function extractFromDocument(doc: Document): JobPageExtract | null {
  // Workday uses data-automation-id attributes extensively
  let text = "";

  // Try to find job description using Workday's data attributes
  const descriptionContainer =
    doc.querySelector('[data-automation-id="jobPostingDescription"]') ||
    doc.querySelector('[data-automation-id="job-description"]') ||
    doc.querySelector('.job-description') ||
    doc.querySelector('[role="main"]');

  if (descriptionContainer) {
    text = descriptionContainer.textContent?.trim() || "";
  }

  // Fallback: get all paragraphs and lists from main content
  if (!text || text.length < 200) {
    const mainContent = doc.querySelector("main") || doc.body;
    const textElements = mainContent.querySelectorAll("p, li, h2, h3, h4");
    const textParts: string[] = [];

    textElements.forEach((el) => {
      const txt = el.textContent?.trim();
      if (txt && txt.length > 0) {
        textParts.push(txt);
      }
    });

    text = textParts.join("\n\n");
  }

  if (!text || text.length < 200) {
    return null;
  }

  // Extract title
  const title =
    doc.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim() ||
    doc.querySelector('h1')?.textContent?.trim() ||
    doc.querySelector('h2')?.textContent?.trim();

  // Extract company name - Workday sites are usually company-specific
  let company: string | undefined;
  const companyElement =
    doc.querySelector('[data-automation-id="company"]') ||
    doc.querySelector('.company-name') ||
    doc.querySelector('meta[property="og:site_name"]');

  if (companyElement) {
    company = companyElement instanceof HTMLMetaElement
      ? companyElement.content
      : companyElement.textContent?.trim();
  }

  // Fallback: extract from URL hostname
  if (!company) {
    const hostMatch = doc.location.hostname.match(/^([^.]+)\./);
    if (hostMatch && hostMatch[1] !== 'www') {
      company = hostMatch[1];
    }
  }

  return {
    title,
    company,
    text
  };
}

export const workdayJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.includes("myworkdayjobs.com") || url.hostname.includes("workday.com");
  },
  extract(doc, url): JobPageExtract | null {
    // Check if we're on an application form page (/apply or /applyManually)
    if (url.pathname.includes("/apply")) {
      // Construct the listing page URL by removing the /apply or /applyManually suffix
      let listingUrl = url.href;
      listingUrl = listingUrl.replace(/\/apply\/applyManually(\?.*)?$/, "$1");
      listingUrl = listingUrl.replace(/\/applyManually(\?.*)?$/, "$1");
      listingUrl = listingUrl.replace(/\/apply(\?.*)?$/, "$1");

      // Show notification to user
      showWorkdayNotification(listingUrl);

      // Return null so job detection fails on application pages
      // Users must visit the listing page to save the description
      return null;
    }

    // We're on a listing page, extract normally
    return extractFromDocument(doc);
  }
};
