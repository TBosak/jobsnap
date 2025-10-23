export function cleanHTMLElement(root: HTMLElement | DocumentFragment): string {
  const working = root.cloneNode(true) as HTMLElement | DocumentFragment;

  const treeWalker = document.createTreeWalker(working, NodeFilter.SHOW_ELEMENT, null);
  const nodesToRemove: Node[] = [];

  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode as HTMLElement;

    // Remove scripts, styles, and noscript tags
    if (node.tagName === "SCRIPT" || node.tagName === "STYLE" || node.tagName === "NOSCRIPT") {
      nodesToRemove.push(node);
      continue;
    }

    // Remove common navigation and UI elements
    if (
      node.tagName === "NAV" ||
      node.tagName === "HEADER" ||
      node.tagName === "FOOTER" ||
      node.getAttribute("role") === "navigation" ||
      node.getAttribute("role") === "banner" ||
      node.getAttribute("role") === "contentinfo"
    ) {
      nodesToRemove.push(node);
      continue;
    }

    // Remove elements with specific classes that indicate non-content
    const classList = node.classList;
    const shouldRemove = Array.from(classList).some(className =>
      className.includes("nav") ||
      className.includes("header") ||
      className.includes("footer") ||
      className.includes("sidebar") ||
      className.includes("menu") ||
      className.includes("cookie") ||
      className.includes("banner") ||
      className.includes("advertisement") ||
      className.includes("social")
    );

    if (shouldRemove) {
      nodesToRemove.push(node);
      continue;
    }

    // Convert BR tags to newlines
    if (node.tagName === "BR") {
      node.replaceWith(document.createTextNode("\n"));
    }
  }

  // Remove all marked nodes
  nodesToRemove.forEach(node => {
    node.parentNode?.removeChild(node);
  });

  const container = document.createElement("div");
  container.appendChild(working instanceof HTMLElement ? working.cloneNode(true) : working.cloneNode(true));
  let text = container.innerText || container.textContent || "";

  // Clean up whitespace and normalize formatting
  text = text
    .replace(/[\r\t]+/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\s{3,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/**
 * Sanitizes HTML string for safe rendering in the UI
 * Removes all scripts, event handlers, and dangerous elements
 * Returns cleaned HTML that's safe to render with dangerouslySetInnerHTML
 */
export function sanitizeHTML(html: string): string {
  // Create a temporary container
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Allowed tags for job descriptions
  const allowedTags = new Set([
    "P", "DIV", "SPAN", "BR", "HR",
    "H1", "H2", "H3", "H4", "H5", "H6",
    "UL", "OL", "LI",
    "STRONG", "B", "EM", "I", "U", "S",
    "A", "BLOCKQUOTE", "PRE", "CODE",
    "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"
  ]);

  // Dangerous attributes that can execute code
  const dangerousAttributes = [
    "onload", "onerror", "onclick", "onmouseover", "onmouseout",
    "onfocus", "onblur", "onchange", "onsubmit", "onkeydown",
    "onkeyup", "onkeypress", "onscroll", "onresize", "ondblclick",
    "oncontextmenu", "oninput", "onwheel", "ondrag", "ondrop"
  ];

  function cleanNode(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;

      // Remove disallowed tags
      if (!allowedTags.has(element.tagName)) {
        // For script, style, and other dangerous tags, remove completely
        if (
          element.tagName === "SCRIPT" ||
          element.tagName === "STYLE" ||
          element.tagName === "IFRAME" ||
          element.tagName === "OBJECT" ||
          element.tagName === "EMBED" ||
          element.tagName === "LINK" ||
          element.tagName === "META" ||
          element.tagName === "NOSCRIPT" ||
          element.tagName === "FORM" ||
          element.tagName === "INPUT" ||
          element.tagName === "BUTTON" ||
          element.tagName === "TEXTAREA" ||
          element.tagName === "SELECT"
        ) {
          element.remove();
          return;
        }
        // For other tags, replace with their content
        const fragment = document.createDocumentFragment();
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }
        element.replaceWith(fragment);
        return;
      }

      // Remove dangerous attributes
      dangerousAttributes.forEach(attr => {
        if (element.hasAttribute(attr)) {
          element.removeAttribute(attr);
        }
      });

      // Sanitize href attributes to prevent javascript: protocol
      if (element.tagName === "A") {
        const href = element.getAttribute("href");
        if (href) {
          const lower = href.toLowerCase().trim();
          if (
            lower.startsWith("javascript:") ||
            lower.startsWith("data:") ||
            lower.startsWith("vbscript:")
          ) {
            element.removeAttribute("href");
          }
        }
        // Add security attributes for external links
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }

      // Remove style attributes that could be used for attacks
      if (element.hasAttribute("style")) {
        const style = element.getAttribute("style") || "";
        // Only allow safe CSS properties
        const safeStyle = style
          .split(";")
          .filter(prop => {
            const lower = prop.toLowerCase();
            return !lower.includes("javascript") &&
                   !lower.includes("expression") &&
                   !lower.includes("behavior") &&
                   !lower.includes("@import") &&
                   !lower.includes("url(");
          })
          .join(";");

        if (safeStyle) {
          element.setAttribute("style", safeStyle);
        } else {
          element.removeAttribute("style");
        }
      }
    }

    // Recursively clean children
    const children = Array.from(node.childNodes);
    children.forEach(child => cleanNode(child));
  }

  cleanNode(temp);
  return temp.innerHTML;
}
