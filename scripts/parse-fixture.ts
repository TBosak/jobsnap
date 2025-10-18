import { parseResume } from "../src/parsing";

async function main() {
  const fixturePaths = [
    "resume_text_rich.pdf",
    "resume_scanned.pdf",
    "resume.docx"
  ];

  for (const fixture of fixturePaths) {
    try {
      const response = await fetch(`fixtures/${fixture}`);
      const buffer = await response.arrayBuffer();
      const file = new File([buffer], fixture);
      const result = await parseResume(file);
      console.log(`Parsed ${fixture} -> ${result.meta.parser}`);
      console.log(JSON.stringify(result.resume, null, 2));
    } catch (error) {
      console.error(`Failed to parse ${fixture}`, error);
    }
  }
}

main().catch((error) => console.error(error));
