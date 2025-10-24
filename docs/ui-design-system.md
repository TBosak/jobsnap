# JobSnap UI Design System

**Pastel Gradient Blast: Bold design through soft colors and generous gradients**

---

## Overview

JobSnap uses a pastel gradient design system that achieves boldness through scale, generous use of gradients, and modern design elements while maintaining a calming, professional color palette. The system creates visual energy without overwhelming users during the stressful job application process.

### Design Philosophy

- **Bold through scale, not intensity** - Large gradients, spacious layouts, prominent elements
- **Calming colors** - Soft pastels (peach, mint, lavender, sky blue) reduce stress
- **Smooth transitions** - Polished animations make interactions feel premium
- **Professional yet friendly** - Appeals to job seekers across industries

---

## Color System

### Pastel Gradient Palette

```css
/* Primary Gradient: Peach → Mint */
--gradient-primary: linear-gradient(135deg, #FFB5B5 0%, #B5E7DD 100%);

/* Secondary Gradient: Lavender → Peach */
--gradient-secondary: linear-gradient(135deg, #D4C5F9 0%, #FFB5B5 100%);

/* Tertiary Gradient: Mint → Sky Blue */
--gradient-tertiary: linear-gradient(135deg, #B5E7DD 0%, #B5D4F9 100%);
```

### Accent Colors

```css
--color-peach: #FFB5B5;      /* Soft peach - primary accent */
--color-mint: #B5E7DD;       /* Soft mint - secondary accent */
--color-lavender: #D4C5F9;   /* Soft lavender - tertiary accent */
--color-sky: #B5D4F9;        /* Soft sky blue - quaternary accent */
--color-butter: #FFF4B5;     /* Soft butter yellow - highlight */
```

### State Colors

```css
/* Active State */
--color-active: #FFD4D4;     /* Peachy pink */
--glow-active: 0 0 24px rgba(255, 180, 180, 0.5);

/* Hover State */
--glow-hover: 0 0 15px rgba(181, 231, 221, 0.4);
```

### Background Colors

```css
/* Light backgrounds with subtle tint */
--color-bg-light: #FAFAF9;
--color-bg-gradient: linear-gradient(135deg, #FFF9F5 0%, #F5F9FF 50%, #F9F5FF 100%);

/* Surface colors */
--color-surface: #FFFFFF;
--color-surface-tinted: rgba(255, 255, 255, 0.9);
```

### Text Colors

```css
/* Dark text for contrast on pastel backgrounds */
--color-text-primary: #2D3748;    /* Dark slate */
--color-text-secondary: #718096;  /* Medium gray */
--color-text-muted: #A0AEC0;      /* Light gray */
```

---

## Typography

### Font Stack

```css
font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Font Weights

```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Type Scale

```css
--text-xs: 0.75rem;    /* 12px - timestamps, captions */
--text-sm: 0.875rem;   /* 14px - body text, labels */
--text-base: 1rem;     /* 16px - primary body */
--text-lg: 1.125rem;   /* 18px - section headers */
--text-xl: 1.25rem;    /* 20px - page titles */
--text-2xl: 1.5rem;    /* 24px - main headings */
```

---

## Spacing & Sizing

### Component Dimensions

```css
/* Popup */
--popup-width: 360px;
--popup-min-height: 400px;
--popup-max-height: 600px;

/* Component heights */
--header-height: 60px;
--card-min-height: 80px;
--fab-size: 56px;
```

### Border Radius

```css
--radius-sm: 8px;      /* Small elements */
--radius-md: 12px;     /* Medium cards */
--radius-lg: 16px;     /* Large cards, containers */
--radius-full: 9999px; /* Pills, FAB, circular elements */
```

### Spacing Scale

```css
--space-1: 4px;    /* Micro spacing */
--space-2: 8px;    /* Tight spacing */
--space-3: 12px;   /* Compact spacing */
--space-4: 16px;   /* Base spacing */
--space-6: 24px;   /* Comfortable spacing */
--space-8: 32px;   /* Generous spacing */
```

---

## Animation System

### Transition Timing

```css
/* Duration */
--duration-fast: 150ms;     /* Quick interactions */
--duration-base: 250ms;     /* Standard transitions */
--duration-slow: 350ms;     /* Emphasized transitions */
--duration-slower: 500ms;   /* Entrance animations */

/* Easing curves */
--easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);      /* Material standard */
--easing-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);    /* Incoming elements */
--easing-accelerate: cubic-bezier(0.4, 0.0, 1, 1);      /* Exiting elements */
--easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);     /* Bouncy, playful */
```

### Common Transitions

```css
/* Base transition (all properties) */
transition: all var(--duration-base) var(--easing-standard);

/* Transform-only (better performance) */
transition: transform var(--duration-base) var(--easing-spring);

/* Color transitions */
transition: background-color var(--duration-base) var(--easing-standard),
            border-color var(--duration-base) var(--easing-standard),
            color var(--duration-base) var(--easing-standard);
```

### Key Animations

**Hover Effects:**
- Scale up: `transform: scale(1.02)`
- Lift up: `transform: translateY(-2px)`
- Shadow elevation
- Subtle glow intensification

**State Changes:**
- Profile activation: Fade in glow effect
- Card selection: Border color transition
- Button press: Scale down → up (tactile feedback)

**Entrance Animations:**
- Profile cards: Stagger fade-in from bottom
- Progress rings: Stroke-dashoffset animation (draw effect)
- Header gradient: Subtle shift animation

**Micro-interactions:**
- Button hover: Lift + shadow
- Icon hover: Slight rotation or bounce
- Card hover: Glow intensification

---

## Shadow System

### Elevation Shadows

```css
/* Subtle depth */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.1);

/* Standard elevation */
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);

/* Prominent elevation */
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

/* Maximum elevation */
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
```

### Glow Effects

```css
/* Active state glow */
--glow-active: 0 0 24px rgba(255, 180, 180, 0.5);

/* Hover state glow */
--glow-hover: 0 0 15px rgba(181, 231, 221, 0.4);

/* Focus ring */
--ring-focus: 0 0 0 3px rgba(212, 197, 249, 0.3);
```

---

## Component Patterns

### Gradient Header

**Visual**: Full-width gradient background with title and action button

**Usage**: Top of popup, page headers

```tsx
<header className="bg-gradient-to-r from-peach to-mint p-6">
  <h1 className="text-2xl font-bold text-slate-800">JobSnap</h1>
  <button>Action</button>
</header>
```

### Profile Card

**Visual**: Rounded pill shape with gradient border when active, progress ring, hover glow

**Usage**: Profile list items in popup and options

```tsx
<div className="rounded-2xl border-2 p-4 transition-all hover:shadow-lg">
  {isActive && <div className="ring-2 ring-pink-300" />}
  <ProgressRing percentage={completeness} />
  <p className="font-semibold">{profile.name}</p>
</div>
```

### Floating Action Button

**Visual**: Circular gradient button with icon, fixed position, press animation

**Usage**: Primary actions in popup

```tsx
<button className="fixed bottom-4 right-4 h-14 w-14 rounded-full bg-gradient-to-br from-lavender to-peach shadow-xl">
  <Icon />
</button>
```

### Progress Ring

**Visual**: Circular SVG with gradient stroke showing completion percentage

**Usage**: Profile completeness indicators

```tsx
<svg className="h-16 w-16">
  <circle
    stroke="url(#gradient)"
    strokeDasharray={`${percentage} 100`}
  />
</svg>
```

---

## Usage Guidelines

### When to Use Gradients

✅ **Use gradients for:**
- Header backgrounds
- Button fills
- Active state indicators
- Progress bars and rings
- Feature highlights

❌ **Avoid gradients for:**
- Body text backgrounds
- Small UI elements (< 32px)
- Busy areas with lots of content
- Elements requiring high contrast

### Accessibility Considerations

**Color Contrast:**
- Text on pastel backgrounds uses dark slate (#2D3748)
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- Active states have additional glow for visibility

**Animation:**
- All animations respect `prefers-reduced-motion`
- Transitions provide tactile feedback without distraction
- No auto-playing animations

**Focus Indicators:**
- Visible focus rings on all interactive elements
- Focus rings use lavender color with 3px width
- Keyboard navigation fully supported

---

## Implementation Notes

### CSS Variables

All colors, gradients, and timing values are defined as CSS variables in `src/ui-shared/gradients.css` and `src/ui-shared/animations.css`. This provides:

- Single source of truth for design tokens
- Easy theme-wide updates
- Consistent values across all components

### Tailwind Integration

Custom gradients and animations are added to `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    backgroundImage: {
      'gradient-primary': 'linear-gradient(135deg, #FFB5B5 0%, #B5E7DD 100%)',
      'gradient-secondary': 'linear-gradient(135deg, #D4C5F9 0%, #FFB5B5 100%)',
      'gradient-tertiary': 'linear-gradient(135deg, #B5E7DD 0%, #B5D4F9 100%)',
    },
    colors: {
      peach: '#FFB5B5',
      mint: '#B5E7DD',
      lavender: '#D4C5F9',
      sky: '#B5D4F9',
      butter: '#FFF4B5',
    }
  }
}
```

### Performance Considerations

- Gradients use CSS, not images (faster, scalable)
- Transitions only on transform and opacity when possible (GPU-accelerated)
- Will-change property used sparingly
- No unnecessary repaints or reflows

---

## Browser Support

- **Chrome/Edge**: Full support (primary target)
- **Firefox**: Full support
- **Safari**: Full support
- **Brave**: Full support

All features degrade gracefully on older browsers:
- Gradients fall back to solid colors
- Animations gracefully skip if not supported
- Core functionality works everywhere

---

## Design Tokens Reference

For complete list of design tokens and their values, see:
- Color variables: `src/ui-shared/gradients.css`
- Animation variables: `src/ui-shared/animations.css`
- Tailwind config: `tailwind.config.ts`

---

## Related Documentation

- [Component Architecture](../CLAUDE.md#component-architecture) - Implementation details
- [README](../README.md) - Project overview with UI screenshots
- [Tailwind Config](../tailwind.config.ts) - Theme customization
