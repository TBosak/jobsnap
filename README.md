# JobSnap Chrome Extension

JobSnap is a browser extension that parses resumes into the JSON Resume schema, lets applicants curate multiple profiles, and autofills job application forms on platforms such as LinkedIn, Greenhouse, Lever, and Workday. Everything runs locally so sensitive resume data stays on-device.

## Features
- **Resume ingestion**: Import PDF or DOCX resumes; fall back to OCR (Tesseract) when PDFs lack text.
- **Schema alignment**: Normalize parsed content into JSON Resume, with editable profiles in the options page.
- **Free vs Pro gating**: One profile for Free users, multiple profiles and history for Pro mode.
- **Smart autofill**: Content scripts detect host pages, select the right adapter, and populate application forms.
- **Offline-first**: Dexie + Chrome storage keep data local; the extension avoids network calls during parsing.

## Tech Stack
React + Vite + TypeScript power the popup and options UIs, styled with shadcn/ui and Tailwind CSS. Parsing relies on `pdf-parse`, `mammoth`, `tesseract.js`, and utility helpers like `zod`, `dayjs`, and `nanoid`. State persists through Chrome storage and IndexedDB (Dexie).

## Getting Started
1. **Install dependencies**
   ```bash
   bun install
   # use npm install if Bun is unavailable
   ```
2. **Run the development server** (popup/options with hot reload)
   ```bash
   bun run dev
   ```
3. **Build the production bundle**
   ```bash
   bun run build
   ```
4. **Run quality gates**
   ```bash
   bun run lint
   bun run test
   ```
   Append `--watch` for TDD or `--runInBand` when debugging flaky Vitest suites.

## Load the Extension in Chrome
1. Run `bun run build` to generate `dist/`.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the `dist/` directory. The popup (`popup.html`) and options page (`options.html`) will hot-reload when rebuilt.

## Project Layout
```
public/          → manifest, icons, Tesseract worker + language data
src/
  background/    → service worker, messaging orchestration
  content/       → host-specific autofill adapters and heuristics
  options/       → profile editor, onboarding flows
  popup/         → quick actions and profile switcher
  parsing/       → resume parsing pipeline (PDF/DOCX + OCR)
  storage/       → Dexie models and Chrome storage bridge
  ui-shared/     → shared components, types, messaging contracts
fixtures/        → sample resumes for manual and automated testing
scripts/         → developer utilities (e.g., parse-fixture runner)
dist/            → build output after `bun run build`
```

## Development Notes
- Vitest powers unit and integration tests; colocate specs as `*.test.ts`.
- Use `scripts/parse-fixture.ts` to sanity-check parser updates against provided resumes.
- Tailwind classes should stay readable by grouping layout → color → state modifiers; rely on Prettier/ESLint for consistency (`bunx prettier --check .`).
- Messaging types live in `src/ui-shared/`—extend them centrally to keep background, popup, and content scripts aligned.

## Contributing
Review `AGENTS.md` for contributor expectations, coding style, and PR conventions. Keep commits focused and follow Conventional Commits (`feat:`, `fix:`, `chore:`). Document any permissions or manifest changes in pull requests and provide screenshots for UI updates.

## License
This project has not declared a license. Please consult the repository owner before distributing code outside the team.
