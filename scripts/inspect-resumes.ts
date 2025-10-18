import { parseResume } from "../src/parsing";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

async function main() {
  const dir = new URL("../resumes", import.meta.url);
  const files = await readdir(dir);
  for (const fileName of files.sort()) {
    const filePath = join(dir.pathname, fileName);
    const buffer = await readFile(filePath);
    const arrayBuffer = buffer.byteLength === buffer.buffer.byteLength
      ? buffer.buffer
      : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const file = new File([arrayBuffer as ArrayBuffer], fileName, {
      type: getMimeType(fileName)
    });
    const result = await parseResume(file);
    console.log("====", fileName, "====");
    console.log(JSON.stringify(result.resume, null, 2));
  }
}

function getMimeType(fileName: string): string {
  const ext = extname(fileName).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".doc":
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
