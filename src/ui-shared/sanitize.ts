export function cleanHTMLElement(root: HTMLElement | DocumentFragment): string {
  const working = root.cloneNode(true) as HTMLElement | DocumentFragment;

  const treeWalker = document.createTreeWalker(working, NodeFilter.SHOW_ELEMENT, null);
  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode as HTMLElement;
    if (node.tagName === "SCRIPT" || node.tagName === "STYLE" || node.tagName === "NOSCRIPT") {
      node.parentNode?.removeChild(node);
    }
    if (node.tagName === "BR") {
      node.replaceWith(document.createTextNode("\n"));
    }
  }

  const container = document.createElement("div");
  container.appendChild(working instanceof HTMLElement ? working.cloneNode(true) : working.cloneNode(true));
  let text = container.innerText || container.textContent || "";
  text = text
    .replace(/[\r\t]+/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\s{3,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}
