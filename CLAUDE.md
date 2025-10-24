# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Package Manager
- Use `bun` as the primary package manager
- Fallback to `npm` only if Bun is unavailable
- `bun install` - install dependencies
- `npm install` - fallback if Bun unavailable

### Development & Build
- `bun run dev` - start Vite dev server for popup and options UI (hot reload)
- `bun run build` - production build for Chrome extension (creates `dist/`)
- `bun run lint` - run ESLint
- `bun run test` - run Vitest tests
- `bun run test --watch` - run tests in watch mode
- `bun run test --runInBand` - debug flaky test suites

### Manual Testing
- `scripts/parse-fixture.ts` - test resume parsing against sample resumes
- Load unpacked extension: Build with `bun run build`, then load `dist/` directory in `chrome://extensions`

## Architecture Overview

### Chrome Extension Structure
This is a Manifest V3 Chrome extension with dual build configuration:
- **Main build** (`vite.config.ts`): popup, options, and background service worker
- **Content script build** (`vite.content.config.ts`): separate IIFE bundle for content injection

### Core Modules

**Background Service Worker** (`src/background/`)
- Orchestrates messaging between popup, options, and content scripts
- Handles profile storage and job data management

**Content Scripts** (`src/content/`)
- Host-specific autofill adapters for LinkedIn, Greenhouse, Lever, Workday
- Job detection and form population logic
- Runs on all URLs but activates based on detected platforms

**Parsing Pipeline** (`src/parsing/`)
- Resume ingestion: PDF (`pdf-parse`, `pdfjs-dist`) and DOCX (`mammoth`)
- OCR fallback using Tesseract.js for PDFs without extractable text
- Normalizes parsed content into JSON Resume schema

**Storage Layer** (`src/storage/`)
- **Chrome storage**: Profile data via `chrome.storage.sync`
- **IndexedDB**: Job data and collections via Dexie
- Bridge between extension surfaces and persistence

**UI Surfaces**
- **Popup** (`src/popup/`): Quick profile switching and actions
- **Options** (`src/options/`): Full profile editor, onboarding, history management

### Key Data Models

**Profiles**: JSON Resume schema with computed skills and metadata
```typescript
interface ProfileRecord {
  id: string;
  name: string;
  resume: JsonResume;
  computedSkills?: string[];
  // ... timestamps, metadata
}
```

**Job Data**: Collections of job descriptions with embeddings
```typescript
interface JDItem {
  id: string;
  collectionId: string;
  source: { url: string; host: string };
  title?: string;
  company?: string;
  text: string;
  // ... embeddings, tags, skills
}
```

**Messaging**: Centralized type-safe communication via `src/ui-shared/messaging.ts`

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Pastel Gradient Design System + shadcn/ui components
- **State**: Chrome storage + Dexie (IndexedDB)
- **AI/ML**: Hugging Face Transformers.js for embeddings
- **Parsing**: pdf-parse, mammoth, tesseract.js
- **Testing**: Vitest

## Component Architecture

### Pastel Gradient UI System

JobSnap implements a modular pastel gradient design system built on reusable component bricks. Each brick is a self-contained UI element with clear interfaces and responsibilities. See [UI Design System](docs/ui-design-system.md) for complete specifications.

#### GradientHeader

**Purpose**: Full-width gradient header with title and optional action buttons

**Interface**:
```typescript
interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  gradientVariant?: 'primary' | 'secondary' | 'tertiary';
}
```

**Responsibilities**:
- Renders bold pastel gradient background using CSS custom properties
- Provides consistent spacing and typography
- Supports optional action buttons for primary interactions

**Usage**: Top of popup UI, page headers in options interface

**Dependencies**: Tailwind gradient utilities, CSS animation variables

#### ProfileCard

**Purpose**: Interactive profile list item with completeness indicator and hover effects

**Interface**:
```typescript
interface ProfileCardProps {
  profile: ProfileRecord;
  isActive: boolean;
  onSelect: (profileId: string) => void;
}
```

**Responsibilities**:
- Displays profile name and metadata
- Shows visual completeness via ProgressRing component
- Applies active state styling (glow effect, border highlight)
- Handles click interactions for profile switching

**Usage**: Profile selection in popup and options pages

**Dependencies**: ProgressRing component, Tailwind animation utilities

#### FloatingActionButton (FAB)

**Purpose**: Circular gradient button for primary actions

**Interface**:
```typescript
interface FloatingActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  label: string; // for accessibility
  position?: 'bottom-right' | 'bottom-left';
}
```

**Responsibilities**:
- Renders fixed-position circular button with gradient background
- Provides tactile press animation on click
- Includes aria-label for screen readers
- Supports custom positioning

**Usage**: Primary actions in popup (e.g., "Add Profile", "Autofill")

**Dependencies**: Tailwind positioning utilities, CSS spring animations

#### ProgressRing

**Purpose**: Circular SVG progress indicator with gradient stroke

**Interface**:
```typescript
interface ProgressRingProps {
  percentage: number; // 0-100
  size?: number; // diameter in pixels
  strokeWidth?: number;
  gradientId?: string; // unique ID for SVG gradient definition
}
```

**Responsibilities**:
- Renders SVG circle with animated stroke-dasharray
- Uses pastel gradient for stroke color
- Displays percentage text in center
- Animates on mount with draw effect

**Usage**: Profile completeness indicators in cards and lists

**Dependencies**: Inline SVG, Tailwind text utilities

### Design Token Integration

All components reference centralized design tokens defined in:
- **Colors**: `src/ui-shared/gradients.css` (pastel palette variables)
- **Animations**: `src/ui-shared/animations.css` (timing and easing curves)
- **Tailwind Config**: `tailwind.config.ts` (extended theme with custom gradients)

This ensures consistent styling across all UI surfaces while maintaining the modular "bricks and studs" architecture.

## Key Development Patterns

### Coding Style
- TypeScript with 2-space indentation
- Named exports for utilities, default exports for components
- Tailwind classes grouped: layout → color → state
- Centralize shared types in `src/ui-shared/`
- Follow existing component patterns before creating new ones

### Extension-Specific Considerations
- **Offline-first**: No remote network calls during parsing
- **Permissions**: Justify any new manifest permissions
- **Content Security Policy**: WASM support for Tesseract and Transformers
- **Cross-surface messaging**: Use typed message contracts from `messaging.ts`

### Testing Strategy
- Colocate tests as `*.test.ts` near source code
- Use sample resumes from `fixtures/` for parser validation
- Mock Chrome APIs with light wrappers
- Focus on parsing edge cases, storage migrations, autofill scoring

### Build System Notes
- Dual Vite configs: main extension surfaces + isolated content script
- Content script builds as IIFE with inlined dependencies
- Background service worker uses ES modules
- WASM assets for Tesseract and Transformers in `public/`

## Security Guidelines
- Preserve offline-first model - no remote calls without design review
- Scrub personal data from test fixtures
- Keep API keys/licenses in untracked `.env` files
- Validate manifest permission changes in PRs