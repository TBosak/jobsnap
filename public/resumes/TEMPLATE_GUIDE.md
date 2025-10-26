# Resume Template Guide

This guide explains how to create custom resume templates for JobSnap using docxtemplater syntax.

## Basic Template Syntax

### Simple Values
Use single curly braces for simple values:
- `{name}` - Full name
- `{email}` - Email address
- `{phone}` - Phone number
- `{website}` - Personal website
- `{linkedin}` - LinkedIn URL
- `{title}` - Professional title/headline
- `{summary}` - Professional summary/bio

### Skills

**Option 1: By Index (Fixed Positions)**
```
{skill1}, {skill2}, {skill3}, {skill4}, {skill5}
```
Available: `{skill1}` through `{skill18}`

**Option 2: Loop (Dynamic)**
```
{#skills}{name}, {/skills}
```
This automatically includes all skills regardless of count.

### Work Experience Loop

```
{#work}
{position} at {company}
{location}
{startMonthName} {startYear} - {endMonthName} {endYear}

{summary}

{/work}
```

#### Available Work Date Components:
- **Start Date:**
  - `{startYear}` - 2019
  - `{startMonth}` - 01-12 (zero-padded)
  - `{startMonthName}` - January
  - `{startMonthShort}` - Jan
  - `{startDay}` - 01-31 (zero-padded)
  - `{startDate}` - Original date string

- **End Date:**
  - `{endYear}` - 2025 (empty for current positions)
  - `{endMonth}` - 01-12 (empty for current positions)
  - `{endMonthName}` - December (empty for current positions)
  - `{endMonthShort}` - Dec (empty for current positions)
  - `{endDay}` - 01-31 (empty for current positions)
  - `{endDate}` - Original date string or "Present" for current positions

**Note:** For current positions (where endDate is "Present" or empty), all end date components (year, month, etc.) are empty strings. Use `{endDate}` to display "Present".

#### Date Format Examples:

**Past Employment:**
```
{startMonthName} {startYear} - {endMonthName} {endYear}
→ September 2019 - January 2025

{startMonthShort} {startYear} - {endMonthShort} {endYear}
→ Sep 2019 - Jan 2025

{startMonth}/{startYear} - {endMonth}/{endYear}
→ 09/2019 - 01/2025

{startMonth}/{startDay}/{startYear} - {endMonth}/{endDay}/{endYear}
→ 09/01/2019 - 01/15/2025
```

**Current Employment (endDate is "Present"):**
```
{startMonthName} {startYear} - {endMonthName} {endYear}
→ September 2019 -   (end components are empty)

{startMonthShort} {startYear} - {endDate}
→ Sep 2019 - Present

{startMonth}/{startYear} - {endDate}
→ 09/2019 - Present
```

**Recommended Patterns for Mixed Employment:**

To handle both past and current positions in the same template:

```
Option 1: Use {endDate} (simplest)
{startMonthShort} {startYear} - {endDate}
→ Past: Sep 2019 - Jan 2025
→ Current: Sep 2019 - Present

Option 2: Conditional with components
{startMonthShort} {startYear} - {endMonthShort} {endYear}{#-endYear}{endDate}{/-endYear}
→ Past: Sep 2019 - Jan 2025
→ Current: Sep 2019 - Present
```

#### Other Work Fields:
- `{company}` - Company name
- `{position}` - Job title
- `{location}` - Work location
- `{summary}` - Job description
- `{highlights}` - Array of achievements (use loop: `{#highlights}{.}{/highlights}`)

### Education Loop

```
{#education}
{degree} in {area}
{institution}, {location}
{startMonthShort} {startYear} - {endMonthShort} {endYear}
GPA: {gpa}

{/education}
```

#### Available Education Date Components:
Same as work experience:
- `{startYear}`, `{startMonth}`, `{startMonthName}`, `{startMonthShort}`, `{startDay}`
- `{endYear}`, `{endMonth}`, `{endMonthName}`, `{endMonthShort}`, `{endDay}`

#### Other Education Fields:
- `{degree}` - Degree type (Bachelor of Science, etc.)
- `{area}` - Field of study
- `{institution}` - School name
- `{location}` - School location
- `{gpa}` - Grade point average

### Certificates Loop

```
{#certificates}
{name}
Issued by {issuer} - {monthName} {year}
{/certificates}
```

#### Available Certificate Date Components:
- `{year}` - 2024
- `{month}` - 01-12
- `{monthName}` - March
- `{monthShort}` - Mar
- `{day}` - 01-31
- `{date}` - Original date string

#### Other Certificate Fields:
- `{name}` - Certificate name
- `{issuer}` - Issuing organization
- `{url}` - Certificate verification URL

## Complete Example Template

```
{name}
{email} | {phone} | {website}
{linkedin}

PROFESSIONAL SUMMARY
{summary}

WORK EXPERIENCE
{#work}
{position}
{company}, {location}
{startMonthShort} {startYear} - {endDate}

{summary}

{/work}

SKILLS
{skill1} | {skill2} | {skill3} | {skill4} | {skill5} | {skill6}

EDUCATION
{#education}
{degree} in {area}
{institution}, {location}
{startMonthShort} {startYear} - {endMonthShort} {endYear}
{/education}

CERTIFICATIONS
{#certificates}
{name} - {issuer}, {monthName} {year}
{/certificates}
```

**Note:** This template uses `{endDate}` for work experience, which automatically handles both past positions (shows the actual end date) and current positions (shows "Present").

## Tips

1. **Conditional Sections**: Wrap optional sections in conditionals:
   ```
   {#linkedin}LinkedIn: {linkedin}{/linkedin}
   ```

2. **Date Flexibility**: Mix and match date components to achieve your preferred format

3. **Empty Values**: Fields without data will be blank - design your template accordingly

4. **Testing**: Upload your template and export a test resume to verify formatting

5. **Loops**: Remember to close all loops with the matching closing tag (`{#work}...{/work}`)

## Supported Date Input Formats

JobSnap automatically parses these date formats:
- ISO: `2019-09-15` or `2019-09`
- US: `09/15/2019`
- Year only: `2019`
- Text: `Present` (for current positions)
