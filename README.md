# JobSnap Chrome Extension

JobSnap is a privacy-focused Chrome extension that streamlines job applications by combining intelligent resume parsing, multi-profile management, and automatic form filling across major job platforms. All processing happens locally—your resume data never leaves your device.

## What JobSnap Does

### Resume Intelligence
- **Smart parsing**: Import PDF or DOCX resumes with automatic OCR fallback for scanned documents
- **Structured profiles**: Normalizes all resume data into JSON Resume format with 12 editable sections
- **Multiple profiles**: Create and manage different resume variations for different roles
- **Skill extraction**: Automatically identifies and normalizes skills from your experience

### Job Application Automation
- **One-click autofill**: Automatically fills application forms on supported platforms
- **8+ job boards supported**: LinkedIn, Greenhouse, Lever, Workday, Oracle, Y Combinator, Adzuna, and more
- **Smart field mapping**: Intelligently matches your profile data to form fields
- **Generic fallback**: Works on unsupported sites with best-effort field detection

### Application Tracking
- **Complete history**: Track every application with status updates (Saved → Applied → Interview → Offer/Rejected)
- **Timeline view**: Visualize your application journey over time
- **Notes & metadata**: Add notes and track which profile you used
- **Export capabilities**: Export history as CSV or JSON for external analysis

### AI-Powered Job Analysis
- **Keyword extraction**: Automatically identifies the 25 most relevant keywords from job descriptions
- **Skill gap analysis**: Compares job requirements against your profile skills
- **Semantic matching**: Uses on-device embeddings to understand skill similarities
- **Job collections**: Organize saved job postings with tags and bulk analysis

## Features

### Resume Parsing Pipeline
- **Multi-format support**: PDF, DOCX, and JSON Resume formats
- **OCR fallback**: Tesseract.js automatically processes scanned/image-based PDFs
- **Semantic extraction**: AI-powered section detection and field extraction
- **Comprehensive fields**: Basics, work experience, education, skills, projects, certifications, publications, languages, interests, awards, volunteer work, and references

### Profile Management
- **Profile editor**: Full-featured interface with 13 tabs for complete control
- **LinkedIn import**: Import profile data directly from LinkedIn
- **Export profiles**: Download as JSON Resume format

### Job Collection & Analysis
- **Auto-detection**: Automatically detects and captures job postings across the web
- **Collections**: Organize jobs by topic, company, or role type
- **Keyword extraction**: Analyzes entire collections to identify common requirements
- **Skill gap reports**: See which skills you're missing for target roles
- **Search & filter**: Find jobs by title, company, tags, or hosting platform

### Privacy & Performance
- **Offline-first**: No network calls during parsing or autofill
- **On-device AI**: Transformers.js and Tesseract.js run entirely in your browser
- **Local storage**: IndexedDB and Chrome Storage keep all data on your machine
- **No tracking**: Your resume and application data never leave your device

## Supported Platforms

### Autofill Adapters
- **LinkedIn** - Job applications and profile import
- **Greenhouse** - Greenhouse-hosted career pages
- **Lever** - Lever job boards (US & EU)
- **Workday** - Workday career portals
- **Oracle** - Oracle Cloud recruiting
- **Y Combinator** - YC job listings
- **Work at a Startup** - Startup job board
- **Adzuna** - Job aggregator
- **Generic** - Best-effort support for other ATS systems

### Job Detection
Content scripts monitor all websites and can detect/save job postings from any platform.

## Tech Stack

**Frontend**: React 18 + TypeScript + Vite
**Styling**: Tailwind CSS + shadcn/ui components
**State**: Chrome Storage + Dexie (IndexedDB)
**AI/ML**: Hugging Face Transformers.js (on-device embeddings)
**Parsing**: pdf-parse, pdfjs-dist, mammoth, tesseract.js
**Testing**: Vitest

## Getting Started

### Prerequisites
- Bun (recommended) or npm
- Chrome or Chromium-based browser

### Installation
```bash
# Install dependencies
bun install
# or: npm install
```

### Development
```bash
# Start dev server (popup/options with hot reload)
bun run dev

# Build for production
bun run build

# Run linter
bun run lint

# Run tests
bun run test

# Test in watch mode
bun run test --watch
```

### Load Extension in Chrome
1. Run `bun run build` to generate the `dist/` directory
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the `dist/` directory
5. The extension icon will appear in your toolbar

### Manual Testing
```bash
# Test resume parsing against sample resumes
bun scripts/parse-fixture.ts
```

## Project Structure

```
jobsnap/
├── public/
│   ├── manifest.json          # Extension manifest (Manifest V3)
│   ├── *.png                  # Extension icons
│   ├── tesseract/             # Tesseract.js WASM + language data
│   └── transformers/          # Transformers.js ONNX runtime
├── src/
│   ├── background/            # Service worker (message orchestration)
│   ├── content/
│   │   ├── adapters/          # Platform-specific autofill logic
│   │   ├── job-adapters/      # Job detection per platform
│   │   └── index.ts           # Content script entry
│   ├── parsing/               # Resume parsing pipeline
│   │   ├── pdf.ts, docx.ts    # Format-specific parsers
│   │   ├── pdf_ocr.ts         # OCR fallback
│   │   └── extractors/        # Field extraction logic
│   ├── analysis/
│   │   ├── embeddings.ts      # Transformers.js integration
│   │   ├── keywords.ts        # Keyword extraction
│   │   └── skills.ts          # Skill normalization
│   ├── storage/
│   │   └── profiles.ts        # Chrome Storage bridge
│   ├── db/
│   │   ├── db.ts              # Dexie setup
│   │   ├── history.ts         # Application history
│   │   └── jd.collections.ts  # Job collections
│   ├── popup/                 # Extension popup UI
│   ├── options/               # Full options page
│   │   └── routes/            # Profiles, History, Collections, Onboarding
│   └── ui-shared/             # Shared types, components, messaging
├── fixtures/                  # Sample resumes for testing
├── scripts/                   # Dev utilities
├── vite.config.ts             # Main build config
├── vite.content.config.ts     # Content script build (IIFE)
└── dist/                      # Build output (git-ignored)
```

## Usage Workflows

### First-Time Setup
1. Install and load the extension
2. Click the extension icon → **Manage**
3. Navigate to **Import Resume**
4. Upload your PDF or DOCX resume
5. Review and edit parsed fields across 13 tabs
6. Name your profile and save

### Applying to a Job
1. Navigate to a job posting on a supported platform
2. Click the JobSnap extension icon
3. Click **Autofill** (if available for that platform)
4. Review auto-filled fields and submit
5. Application automatically tracked in History

### Managing Multiple Profiles
1. Open extension options → **Profiles**
2. Create additional profiles for different roles
3. Use the popup to switch between profiles
4. Each profile can have different skills, experience emphasis, etc.

### Tracking Applications
1. Open extension options → **History**
2. View list or timeline of all applications
3. Update status: Applied → Interview → Offer/Rejected
4. Add notes or filter by date/platform
5. Export as CSV for external tracking

### Analyzing Job Requirements
1. Save job postings to a collection
2. Open extension options → **Collections**
3. Select a collection → **Extract Keywords**
4. View top 25 keywords from all jobs
5. Run **Skill Gap Analysis** against your profile
6. See which skills you're missing

## Development Guidelines

### Code Style
- TypeScript with 2-space indentation
- Named exports for utilities, default exports for components
- Tailwind classes grouped: layout → color → state
- Centralize shared types in `src/ui-shared/`

### Testing
- Colocate tests as `*.test.ts` near source files
- Use fixtures from `fixtures/` for parser validation
- Mock Chrome APIs with light wrappers
- Focus on edge cases and regression prevention

### Extension Architecture
- **Dual build system**: Main extension + isolated content script (IIFE)
- **Message passing**: Type-safe contracts in `src/ui-shared/messaging.ts`
- **Offline-first**: No remote API calls during core functionality
- **CSP-compliant**: WASM support for Tesseract and Transformers

### Key Patterns
- All Chrome API interactions should be wrapped for testability
- Storage migrations use Dexie version system
- Content scripts detect platform via URL patterns
- Profile skills are computed/cached for performance

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Commits**: Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
2. **Code style**: Run `bun run lint` before committing
3. **Tests**: Add tests for new features and bug fixes
4. **Manifest changes**: Document any new permissions in PR description
5. **UI changes**: Include screenshots in PR
6. **Privacy**: Maintain offline-first model—no remote calls without design review

See `CLAUDE.md` for detailed development guidance.

## Security & Privacy

- **No data collection**: JobSnap doesn't collect or transmit any user data
- **Local processing**: All AI/ML runs on-device
- **No analytics**: No tracking or telemetry
- **No accounts**: No sign-up or authentication required
- **Open permissions**: Only requests access to job board domains for autofill

## License

This project has not declared a license. Please consult the repository owner before distributing or modifying the code.

## Support

For bugs, feature requests, or questions, please open an issue on the GitHub repository.

---

**Built with privacy in mind. Your resume data never leaves your device.**
