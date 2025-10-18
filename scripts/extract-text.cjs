const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

async function extract(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const dataBuffer = fs.readFileSync(filePath);
    const result = await pdfParse(dataBuffer);
    return result.text;
  }
  if (ext === ".docx" || ext === ".doc") {
    const buffer = fs.readFileSync(filePath);
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  return "";
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    throw new Error("Provide a resume filename");
  }
  const filePath = path.resolve(__dirname, "..", "resumes", target);
  const text = await extract(filePath);
  console.log(text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
