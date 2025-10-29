import type { DocxParseResult, PdfLine, PdfTextItem } from "./types";

export async function parseDocx(buffer: ArrayBuffer): Promise<DocxParseResult> {
  const mammoth = await import("mammoth/mammoth.browser");

  // Extract both HTML and raw text for better structure understanding
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer: buffer }),
    mammoth.extractRawText({ arrayBuffer: buffer })
  ]);

  // Process the HTML to extract better structure with formatting metadata
  const { text: structuredText, lines } = enhanceDocxStructure(htmlResult.value, textResult.value);

  return {
    text: structuredText,
    lines, // Include structured lines like PDF parser does
    meta: {
      parser: "docx",
      charCount: structuredText.length
    }
  };
}

function enhanceDocxStructure(html: string, rawText: string): { text: string; lines: PdfLine[] } {
  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Extract text with improved structure preservation
  const structuredLines: string[] = [];
  const pdfStyleLines: PdfLine[] = [];

  // Process the document structure
  const walker = document.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    null
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const element = currentNode as Element;

      // Handle different elements that indicate structure
      if (element.tagName === 'P') {
        const { text, isBold } = extractTextWithFormatting(element);
        if (text.trim()) {
          structuredLines.push(text.trim());
          pdfStyleLines.push([createPdfTextItem(text.trim(), isBold)]);
        }
      } else if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
        const { text } = extractTextWithFormatting(element);
        if (text.trim()) {
          // Ensure headers are on their own lines and properly formatted
          structuredLines.push('');
          structuredLines.push(text.trim().toUpperCase());
          structuredLines.push('');

          pdfStyleLines.push([]);
          pdfStyleLines.push([createPdfTextItem(text.trim().toUpperCase(), true)]); // Headers are always bold
          pdfStyleLines.push([]);
        }
      } else if (element.tagName === 'TABLE') {
        // Handle tables common in ATS resumes
        const tableText = processTable(element);
        if (tableText.trim()) {
          structuredLines.push('');
          structuredLines.push(tableText);
          structuredLines.push('');

          pdfStyleLines.push([]);
          pdfStyleLines.push([createPdfTextItem(tableText, false)]);
          pdfStyleLines.push([]);
        }
      } else if (element.tagName === 'LI') {
        const { text } = extractTextWithFormatting(element);
        if (text.trim()) {
          const bulletText = '• ' + text.trim();
          structuredLines.push(bulletText);
          pdfStyleLines.push([createPdfTextItem(bulletText, false)]);
        }
      }
    }
    currentNode = walker.nextNode();
  }

  let result = structuredLines.join('\n');

  // If HTML processing didn't work well, fall back to enhanced raw text
  if (result.length < rawText.length * 0.8) {
    result = enhanceRawText(rawText);
    // Recreate lines from the fallback text
    return {
      text: cleanupDocxText(result),
      lines: result.split('\n').map(line => [createPdfTextItem(line, false)])
    };
  }

  // Clean up the result
  return {
    text: cleanupDocxText(result),
    lines: pdfStyleLines
  };
}

function createPdfTextItem(text: string, isBold: boolean): PdfTextItem {
  return {
    text,
    fontName: isBold ? 'Bold' : 'Regular',
    height: 12,
    width: text.length * 6,
    x: 0,
    y: 0,
    hasEOL: true
  };
}

function extractTextWithFormatting(element: Element): { text: string; isBold: boolean } {
  let text = '';
  let hasBold = false;

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childElement = child as Element;

      // Handle specific formatting elements
      if (childElement.tagName === 'STRONG' || childElement.tagName === 'B') {
        text += childElement.textContent || '';
        hasBold = true; // Mark that this element has bold text
      } else if (childElement.tagName === 'BR') {
        text += '\n';
      } else {
        text += childElement.textContent || '';
      }
    }
  }

  return { text, isBold: hasBold };
}

// Legacy function for table processing (no formatting tracking needed)
function extractTextFromElement(element: Element): string {
  return extractTextWithFormatting(element).text;
}

function processTable(table: Element): string {
  const rows: string[] = [];
  const tableRows = table.querySelectorAll('tr');

  for (const row of tableRows) {
    const cells = Array.from(row.querySelectorAll('td, th'));
    const cellTexts = cells.map(cell => (cell.textContent || '').trim()).filter(Boolean);

    if (cellTexts.length > 0) {
      // For ATS tables, often the first column is labels, second is content
      if (cellTexts.length === 2) {
        rows.push(`${cellTexts[0]}: ${cellTexts[1]}`);
      } else {
        rows.push(cellTexts.join(' | '));
      }
    }
  }

  return rows.join('\n');
}

function enhanceRawText(rawText: string): string {
  return rawText
    // Preserve paragraph breaks
    .replace(/\s{2,}/g, '\n')
    // Fix common ATS formatting issues
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
    .replace(/(\w)(●|•|\*)/g, '$1\n$2') // Ensure bullets are on new lines
    .replace(/(●|•|\*)(\w)/g, '$1 $2') // Add space after bullets
    // Preserve section breaks
    .replace(/([.!?])\s*([A-Z][A-Z\s]{2,})/g, '$1\n\n$2')
    .trim();
}

function cleanupDocxText(text: string): string {
  return text
    // Normalize whitespace while preserving structure
    .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
    .replace(/\n\s+/g, '\n') // Remove leading whitespace on new lines
    .replace(/\s+\n/g, '\n') // Remove trailing whitespace before newlines
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines to 2
    // Fix common parsing artifacts
    .replace(/(\w)\s*-\s*(\w)/g, '$1-$2') // Fix broken hyphenated words
    .replace(/(\w)\s*'\s*(\w)/g, "$1'$2") // Fix broken contractions
    // Ensure proper spacing around punctuation
    .replace(/(\w)([.!?])(\w)/g, '$1$2 $3')
    .trim();
}
