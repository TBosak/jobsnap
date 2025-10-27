# JobSnap Feature Walkthrough - Video Demo Script

This guide provides a step-by-step walkthrough of all JobSnap features for video demonstrations.

---

## Introduction (30 seconds)

**Talking Points:**
- JobSnap is a privacy-focused Chrome extension that streamlines job applications
- Combines resume parsing, multi-profile management, and automatic form filling
- All processing happens locally—your data never leaves your device
- Supports 8+ major job platforms plus generic fallback

**Show:**
- Extension icon in Chrome toolbar
- Quick mention of supported platforms (LinkedIn, Greenhouse, Lever, Workday, etc.)

---

## Part 1: First-Time Setup & Resume Import (3-4 minutes)

### 1.1 Install and Open Extension

1. Click the **JobSnap** extension icon in Chrome toolbar
2. First-time users see the welcome screen
3. Click **Get Started** or **Manage** to open options page

### 1.2 Import Your Resume

**Option A: Upload PDF/DOCX Resume**

1. Navigate to the **Import Resume** section (or Profiles → Import)
2. Click **Choose File** or drag-and-drop your resume
3. Wait for parsing (show progress indicator)
   - Mention: "PDF text extraction with OCR fallback for scanned documents"
   - Mention: "Automatic section detection using AI"

4. **Review Parsed Data** - Show the 13 editable tabs:
   - **Basics** - Name, email, phone, location, summary
   - **Work** - Job history with dates, titles, descriptions
   - **Education** - Degrees, schools, dates, GPA
   - **Skills** - Auto-extracted skills (mention: "AI-powered extraction")
   - **Projects** - Personal/professional projects
   - **Certifications** - Licenses and certifications
   - **Publications** - Papers, articles, books
   - **Languages** - Language proficiency levels
   - **Interests** - Hobbies and interests
   - **Awards** - Honors and recognition
   - **Volunteer** - Community service
   - **References** - Professional references
   - **Metadata** - Profile settings and preferences

5. **Edit and correct** any parsing errors
   - Show adding/editing/deleting entries
   - Show the clean UI with gradient accents

6. **Name your profile** (e.g., "Software Engineer - Full Stack")
7. Click **Save Profile**

**Option B: Import from LinkedIn**

1. Navigate to your LinkedIn profile page
2. Click the JobSnap extension icon
3. Click **Import from LinkedIn**
4. Show how LinkedIn data auto-populates the profile
5. Review and edit as needed
6. Save the profile

### 1.3 Profile Completeness Indicator

- Show the **circular progress ring** on the profile card
- Explain: "Tracks how complete your profile is across all sections"
- Show how the percentage increases as you add more information

---

## Part 2: Managing Multiple Profiles (2 minutes)

### 2.1 Create Additional Profiles

1. Go to **Profiles** tab in options
2. Click **+ New Profile** or **Import Another Resume**
3. Upload a tailored resume (e.g., "Data Scientist - ML Focus")
4. Show the profile list with multiple profiles

### 2.2 Switch Between Profiles

**From Popup:**
1. Click extension icon
2. Show list of profiles with completeness indicators
3. Click a profile to make it active
4. Active profile has a checkmark/highlight

**From Options:**
1. In Profiles tab, click **Set Active** on any profile
2. Show visual feedback (glow/border on active profile)

### 2.3 Edit and Delete Profiles

1. Click **Edit** on a profile to open the full editor
2. Show how changes save automatically
3. Click **Delete** to remove a profile (show confirmation dialog)

### 2.4 Export Profiles

1. Click **Export** on a profile
2. Download as **JSON Resume** format
3. Mention: "Standard format compatible with other tools"

---

## Part 3: Autofilling Job Applications (3-4 minutes)

### 3.1 Supported Platforms Demo

**Show autofill on multiple platforms:**

**LinkedIn:**
1. Navigate to a LinkedIn job application
2. Click **JobSnap** extension icon
3. Click **Autofill** button
4. Watch fields populate automatically:
   - First name, Last name
   - Email, Phone
   - Location
   - Resume upload (if applicable)
   - Work experience
   - Education

**Greenhouse:**
1. Open a Greenhouse job application
2. Show autofill in action
3. Highlight: "Detects platform automatically"

**Lever:**
1. Open a Lever application
2. Autofill form fields
3. Show how it handles different form layouts

**Workday:**
1. Navigate to Workday application
2. Show multi-page form handling
3. Mention: "Handles complex multi-step applications"

### 3.2 Autofill Features

- **Smart field mapping** - Show how JobSnap matches profile data to form fields
- **Partial fills** - Some fields auto-fill, others remain for manual entry
- **Review before submit** - Always review auto-filled data
- **No auto-submit** - You control when to submit

### 3.3 Generic Platform Support

1. Navigate to an unsupported job board
2. Show how generic adapter works with best-effort field detection
3. Mention: "Works on most ATS systems, not just the 8+ we officially support"

---

## Part 4: Job Detection & Saving (2-3 minutes)

### 4.1 Automatic Job Detection

1. Navigate to any job posting (e.g., LinkedIn, Greenhouse)
2. Show the **extension icon badge** or indicator
3. Open popup - show detected job with title and company
4. Explain: "JobSnap automatically detects job postings on any site"

### 4.2 Save Job to Collection

1. On a job posting page, click extension icon
2. Click **Save Job** button
3. **Choose collection dialog** appears:
   - Option A: Select existing collection
   - Option B: Create new collection
4. Enter collection name (e.g., "Senior Developer Roles")
5. Click **Save**
6. Show success toast notification

### 4.3 Save from Application Page

1. Navigate to a Lever or Greenhouse application form
2. Click **Save Job**
3. Show: "JobSnap fetches the job description from the posting page"
4. Mention: "Backwards filling - gets full description even from application forms"

### 4.4 Save Selected Text

1. On any page, highlight job description text
2. Right-click → **Save to JobSnap** (context menu)
3. Choose collection
4. Mention: "Works on any website, even non-standard job boards"

---

## Part 5: Job Collections & Analysis (4-5 minutes)

### 5.1 Viewing Collections

1. Open extension options → **Collections** tab
2. Show list of collections with metadata:
   - Collection name
   - Number of jobs
   - Last updated date
   - Tags

3. Click on a collection to view jobs inside

### 5.2 Collection Job List

**Show the job list interface:**
- Job title and company
- Source platform (LinkedIn, Greenhouse, etc.)
- Date saved
- Tags
- Keyword count

**Demonstrate actions:**
1. **Search/filter** jobs by title, company, or tags
2. **Sort** by date, title, or company
3. **Click a job** to view full description in side panel
4. **Delete** jobs from collection

### 5.3 Keyword Extraction

1. Select a collection with multiple jobs (5-10 jobs ideal)
2. Click **Extract Keywords** button
3. Wait for analysis (show progress)
4. **Results display**:
   - Top 25 keywords ranked by frequency
   - Visual representation (list with counts or word cloud)
   - Mentions: "Helps you understand common requirements across roles"

5. Show how keywords are clickable/filterable

### 5.4 Skill Gap Analysis

1. In a collection, click **Skill Gap Analysis**
2. Select which profile to compare against
3. Wait for analysis
4. **Results show**:
   - **Skills you have** ✓ (from your profile)
   - **Skills you're missing** ✗ (from job requirements)
   - **Match percentage** (e.g., "You match 72% of required skills")
   - **Semantic matching** - Show similar skills (e.g., "React" matches "React.js")

5. Mention: "Uses on-device AI embeddings for semantic understanding"

### 5.5 Bulk Operations

1. Select multiple jobs (checkboxes)
2. **Bulk actions**:
   - Add tags to selected jobs
   - Move to another collection
   - Delete selected jobs
   - Export selected jobs as CSV/JSON

---

## Part 6: Application History Tracking (3 minutes)

### 6.1 Automatic History Logging

1. Go to a job posting and click **Autofill**
2. Complete and submit the application
3. Open options → **History** tab
4. Show the new entry:
   - Job title and company
   - Date applied
   - Platform (LinkedIn, Greenhouse, etc.)
   - Profile used
   - Initial status: **Applied**

### 6.2 Manual History Entry

1. Click **+ Add Application** in History tab
2. Fill in job details manually:
   - Company name
   - Job title
   - Application date
   - Status
   - Notes
3. Save

### 6.3 Status Updates

**Show the status progression:**
1. Click on an application entry
2. Update status dropdown:
   - **Saved** - Job saved but not applied
   - **Applied** - Application submitted
   - **Interview** - Interview scheduled/completed
   - **Offer** - Job offer received
   - **Rejected** - Application rejected
   - **Withdrawn** - You withdrew application

3. Show how status updates persist
4. Add notes (e.g., "Phone screen scheduled for 3/15")

### 6.4 History Views

**List View:**
- Table with all applications
- Columns: Date, Company, Title, Status, Platform
- Sort and filter options

**Timeline View:**
1. Click **Timeline** view
2. Show chronological visualization:
   - Applications plotted over time
   - Color-coded by status
   - Hover for details
3. Filter by date range (last week, month, quarter, year)

### 6.5 Search and Filter

1. **Search** by company name or job title
2. **Filter by status** (e.g., show only "Interview" stage)
3. **Filter by platform** (e.g., only LinkedIn applications)
4. **Filter by date range**
5. **Filter by profile used**

### 6.6 Export History

1. Click **Export** button in History tab
2. Choose format:
   - **CSV** - For spreadsheets (Excel, Google Sheets)
   - **JSON** - For data analysis or backup
3. Download file
4. Mention: "Track your applications externally or backup your data"

---

## Part 7: Advanced Features (2 minutes)

### 7.1 Profile Skills Management

1. Go to profile editor → **Skills** tab
2. Show **auto-extracted skills** from resume
3. **Add custom skills** manually
4. **Remove irrelevant skills**
5. Show **skill normalization** (e.g., "JavaScript" and "JS" merged)
6. Mention: "These skills are used for job matching and gap analysis"

### 7.2 Collection Tags

1. In Collections, add tags to jobs:
   - By role type: "frontend", "backend", "full-stack"
   - By priority: "priority", "maybe", "backup"
   - By company size: "startup", "enterprise"
   - Custom tags

2. Filter jobs by tags
3. Bulk tag operations

### 7.3 Job Metadata

1. Click on a saved job to view details:
   - Full job description (HTML preserved)
   - Source URL (clickable)
   - Date captured
   - Word count
   - Estimated reading time
   - Platform detected

### 7.4 Browser Integration

**Context Menu:**
1. Right-click on any page → **JobSnap** submenu
2. Options:
   - Save selected text to collection
   - Save current page as job posting

**Keyboard Shortcuts** (if implemented):
- Quick save job
- Toggle autofill
- Open popup

---

## Part 8: Privacy & Local Processing (1 minute)

### 8.1 Privacy Highlights

**Talking Points:**
- "All resume parsing happens locally using WASM (Tesseract, Transformers.js)"
- "No data sent to external servers"
- "No account required, no sign-in"
- "No tracking or analytics"
- "Your resume data stays in Chrome's local storage"

**Show:**
1. Open Chrome DevTools → **Application** tab
2. Show **IndexedDB** with job collections
3. Show **Chrome Storage** with profile data
4. Mention: "You can export everything and delete at any time"

### 8.2 Offline Capability

1. Disconnect from internet (or show airplane mode)
2. Parse a resume - still works
3. Edit profiles - still works
4. View collections and history - still works
5. Mention: "Only autofill requires internet (to access job sites)"

---

## Part 9: Settings & Customization (1 minute)

### 9.1 Extension Settings

1. Open options → **Settings** tab
2. Show available settings:
   - Default profile for autofill
   - Auto-save applications to history
   - Notification preferences
   - Theme options (if available)
   - Data management (clear data, export all)

### 9.2 Data Management

1. **Export all data** - Backup everything (profiles + collections + history)
2. **Clear all data** - Reset extension to fresh state
3. **Import data** - Restore from backup

---

## Part 10: Troubleshooting & Tips (1 minute)

### 10.1 Common Workflows

**Workflow 1: Apply to multiple jobs quickly**
1. Create tailored profiles for different roles
2. Browse job boards
3. Save interesting jobs to collections
4. Switch profiles as needed
5. Autofill applications

**Workflow 2: Research a new role**
1. Create collection for target role (e.g., "Product Manager")
2. Save 10-20 job postings
3. Run keyword extraction
4. Identify common requirements
5. Run skill gap analysis
6. Update your resume/profile to fill gaps

**Workflow 3: Track application pipeline**
1. Apply to jobs using autofill
2. Track in History
3. Update status as you progress
4. Add interview notes
5. Export for external tracking

### 10.2 Pro Tips

- **Tip 1**: Create profiles for each resume version you maintain
- **Tip 2**: Use tags to organize jobs by priority or fit
- **Tip 3**: Run keyword extraction before applying to understand key requirements
- **Tip 4**: Use skill gap analysis to tailor your resume for specific roles
- **Tip 5**: Export history regularly as backup
- **Tip 6**: Use the selected text save feature for non-standard job pages

---

## Conclusion (30 seconds)

**Recap:**
- Import and parse resumes with AI
- Manage multiple profiles for different roles
- Autofill applications on 8+ major platforms
- Save and organize job postings
- Extract keywords and analyze skill gaps
- Track your application pipeline
- Everything stays private and local

**Call to Action:**
- "Available now on the Chrome Web Store"
- "Open source on GitHub"
- "No account required, completely free"
- "Your job search, streamlined and private"

---

## Video Production Notes

### Timing Breakdown
- Introduction: 0:30
- Part 1 (Setup): 3:00
- Part 2 (Profiles): 2:00
- Part 3 (Autofill): 3:30
- Part 4 (Saving Jobs): 2:30
- Part 5 (Collections): 4:30
- Part 6 (History): 3:00
- Part 7 (Advanced): 2:00
- Part 8 (Privacy): 1:00
- Part 9 (Settings): 1:00
- Part 10 (Tips): 1:00
- Conclusion: 0:30
- **Total: ~24 minutes**

### Suggested Edits for Shorter Versions

**10-minute version:** Parts 1, 3, 4, 5, 6 (core features only)

**5-minute version:** Parts 1 (condensed), 3, 4, 6 (history basics)

**1-minute version:** Quick montage of: Import → Edit → Autofill → Save Job → View History

### Visual Guidelines
- Use a clean test environment with sample data
- Prepare 2-3 test resumes beforehand
- Bookmark 5-6 test job postings across platforms
- Pre-create one collection with 5-10 jobs for keyword demo
- Use cursor highlighting for screen recording
- Add text overlays for feature names
- Use zoom-in effects for important UI elements
- Background music: Upbeat, professional, non-distracting

### Sample Data Recommendations
- Use fictional resume data or heavily redacted real data
- Test job postings from public job boards
- Clear Chrome storage before recording for clean slate
- Prepare profiles: "Software Engineer", "Data Scientist", "Product Manager"
- Collections: "Senior Dev Roles", "Startup Jobs", "Remote Positions"
