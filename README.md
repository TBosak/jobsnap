# JobSnap Chrome Extension

JobSnap is a privacy-focused Chrome extension that streamlines job applications by combining intelligent resume parsing, multi-profile management, and automatic form filling across major job platforms. Featuring a bold pastel gradient UI that makes job hunting feel less stressful, all processing happens locally—your resume data never leaves your device.

All profiles are stored using the open [JSON Resume](https://jsonresume.org/) standard, a community-driven specification for resume data that ensures your information is portable and future-proof.

## What JobSnap Does

### Resume Intelligence
- **Smart parsing**: Import PDF or DOCX resumes with automatic OCR fallback for scanned documents
- **Structured profiles**: Normalizes all resume data into [JSON Resume](https://jsonresume.org/) format with 13 editable sections
- **Multiple profiles**: Create and manage different resume variations for different roles
- **Skill extraction**: Automatically identifies and normalizes skills from your experience

### Job Application Automation
- **One-click autofill**: Automatically fills application forms on supported platforms
- **6 dedicated adapters**: LinkedIn, Greenhouse, Lever, Workday, Oracle, plus generic fallback for other sites
- **Smart field mapping**: Intelligently matches your profile data to form fields
- **Generic fallback**: Works on unsupported sites with best-effort field detection

### Application Tracking
- **Complete history**: Track every application with status updates (Saved → Applied → Interview → Offer/Rejected)
- **Timeline view**: Visualize your application journey over time
- **Notes & metadata**: Add notes and track which profile you used
- **Export capabilities**: Export history as CSV or JSON for external analysis
- **Smart reminders**: Get browser notifications for no-response follow-ups, ghosting detection, daily application goals, and thank-you note reminders

### AI-Powered Job Analysis
- **Keyword extraction**: Automatically identifies the 25 most relevant keywords from job descriptions
- **Skill gap analysis**: Compares job requirements against your profile skills
- **Semantic matching**: Uses on-device embeddings to understand skill similarities
- **Job collections**: Organize saved job postings with tags and bulk analysis

## Features

### Resume Parsing Pipeline
- **Multi-format support**: PDF, DOCX, and [JSON Resume](https://jsonresume.org/) formats
- **OCR fallback**: Tesseract.js automatically processes scanned/image-based PDFs
- **Semantic extraction**: AI-powered section detection and field extraction
- **Comprehensive fields**: Basics, work experience, education, skills, projects, certifications, publications, languages, interests, awards, volunteer work, and references

### Profile Management
- **Profile editor**: Full-featured interface with 13 tabs for complete control
- **LinkedIn import**: Import profile data directly from LinkedIn
- **Export profiles**: Download as [JSON Resume](https://jsonresume.org/) format

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

### Dedicated Adapters (Autofill or Job Description)
- **LinkedIn** - Job applications and profile import
- **Greenhouse** - Greenhouse-hosted career pages
- **Lever** - Lever job boards (US & EU)
- **Workday** - Workday career portals
- **Workable** - Workable-hosted job boards (jobs.workable.com)
- **Oracle** - Oracle Cloud recruiting
- **Y Combinator** - YC job listings
- **Work at a Startup** - Startup job board
- **Adzuna** - Job aggregator
- **Generic** - Best-effort support for other ATS systems

### Job Detection
Content scripts monitor all websites and can detect/save job postings from any platform.

## Design

### Pastel Gradient UI

JobSnap features a bold, modern interface built with a pastel gradient design system:

- **Calming Colors**: Soft peach, mint, lavender, and sky blue gradients
- **Bold Through Scale**: Generous gradients, spacious layouts, prominent elements
- **Smooth Animations**: Polished transitions and hover effects
- **Professional Yet Friendly**: Appeals to job seekers across industries

The UI makes job hunting feel less stressful by combining visual energy with calming pastel tones. See [UI Design System](docs/ui-design-system.md) for complete specifications.

## Tech Stack

**Frontend**: React 18 + TypeScript + Vite
**Styling**: Tailwind CSS + Pastel Gradient Design System + shadcn/ui components
**State**: Chrome Storage + Dexie (IndexedDB)
**AI/ML**: Hugging Face Transformers.js (on-device embeddings)
**Parsing**: pdf-parse, pdfjs-dist, mammoth, tesseract.js

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
4. Upload your PDF/DOCX resume(s) or [JSON Resume](https://jsonresume.org/) file(s) (multiple resume files will be parsed as a single profile and bring up a conflict resolution modal as needed)
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

### Extension Architecture
- **Dual build system**: Main extension + isolated content script (IIFE)
- **Message passing**: Type-safe contracts in `src/ui-shared/messaging.ts`
- **Offline-first**: No remote API calls during core functionality
- **CSP-compliant**: WASM support for Tesseract and Transformers

### Key Patterns
- Storage migrations use Dexie version system
- Content scripts detect platform via URL patterns
- Profile skills are computed/cached for performance

## Resume Templates

### Using Templates

JobSnap includes a flexible resume export system that lets you generate professional resumes from your profile data:

1. **Built-in templates**: Use the default basic resume template included with JobSnap
2. **Custom templates**: Upload your own DOCX templates with personalized designs
3. **Flexible formatting**: Templates support loops, conditionals, and flexible date formatting

### Creating Custom Templates

Want to create your own resume template?

- **In-app help**: Click the help icon (?) next to "Upload Custom Template" for an interactive guide
- **Template Guide**: See the [Template Guide](public/resumes/TEMPLATE_GUIDE.md) for complete documentation on:
  - Template syntax and available fields
  - Date formatting options (full month names, short names, numeric)
  - Skills, work experience, education, and certification sections
  - Loop and conditional syntax
  - Complete working examples

### Contributing Resume Templates

We welcome contributions of resume templates! If you've created a great template and want to share it with the community:

#### Built-in Templates

1. **Create your template**: Design a DOCX template using docxtemplater syntax
2. **Test thoroughly**: Export resumes with your template using different profiles
3. **Add to manifest**: Update `public/resumes/manifest.json`:
   ```json
   {
     "name": "modern-tech",
     "displayName": "Modern Tech Resume",
     "path": "/resumes/modern-tech.docx",
     "description": "Clean, modern template optimized for tech roles",
     "builtin": true
   }
   ```
4. **Place template file**: Add your `.docx` file to `public/resumes/`
5. **Submit PR**

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Manifest changes**: Document any new permissions in PR description
2. **Privacy**: Maintain offline-first model—no remote calls without design review

## Security & Privacy

- **No data collection**: JobSnap doesn't collect or transmit any user data
- **Local processing**: All AI/ML runs on-device
- **No analytics**: No tracking or telemetry
- **No accounts**: No sign-up or authentication required
- **Open permissions**: Only requests access to job board domains for autofill

## Support

For bugs, feature requests, or questions, please open an issue on the GitHub repository.