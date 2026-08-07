# MuviDB Design System & Theme Token Guide

## Overview & Architecture
MuviDB uses a dynamic, CSS variable-driven Design System built into `@tailwindcss/vite` and `src/index.css`. The design system fully supports both **Dark Theme** (default) and **Light Theme** seamlessly without hardcoded background or text color overrides.

---

## 🎨 Color Tokens & Theme Matrix

### 1. Canvas & Backgrounds
| Token Class | CSS Variable | Dark Theme Value | Light Theme Value | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `bg-bg` | `--color-bg` | `#0B0B0B` | `#F9FAFB` | Main viewport/page background |
| `bg-surface` | `--color-surface` | `#1A1A1A` | `#FFFFFF` | Primary cards, modals, hero banners, panels |
| `bg-surface-2` | `--color-surface-2` | `#242424` | `#F3F4F6` | Secondary cards, hover states, muted containers |
| `bg-surface-3` | `--color-surface-3` | `#2E2E2E` | `#E5E7EB` | Input fields, active badges, sunken containers |

### 2. Typography & Contrast Tokens
| Token Class | CSS Variable | Dark Theme Value | Light Theme Value | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-text-primary` | `--color-text-primary` | `#FFFFFF` | `#111827` | Headings, main body text, title labels |
| `text-text-secondary` | `--color-text-secondary` | `#B0B0B0` | `#4B5563` | Subtitles, metadata labels, secondary descriptions |
| `text-text-muted` | `--color-text-muted` | `#707070` | `#6B7280` | Placeholders, timestamps, captions, disabled text |

### 3. Borders & Dividers
| Token Class | CSS Variable | Dark Theme Value | Light Theme Value | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `border-border` | `--color-border` | `rgba(255,255,255,0.24)` | `rgba(34,42,53,0.30)` | Card borders, section dividers, input outlines |
| `border-hairline` | `--color-hairline` | `rgba(255,255,255,0.05)` | `rgba(34,42,53,0.07)` | Subtle grid separators, inner row lines |

### 4. Brand & Accents
| Token Class | CSS Variable | Value | Usage |
| :--- | :--- | :--- | :--- |
| `bg-brand` / `text-brand` | `--color-brand` | `#FF5A1F` | Primary CTAs, active links, brand logo accent |
| `bg-brand-hover` | `--color-brand-hover` | `#E04810` | Hover states for primary buttons |
| `text-on-brand` | `--color-on-brand` | `#000000` (dark) / `#FFFFFF` (light) | Text rendered inside `bg-brand` buttons |

---

## 🚫 Antipatterns (Strictly Prohibited)

1. **NEVER hardcode `text-white` on card titles or page headings**:
   - ❌ `className="text-2xl font-bold text-white"` (Invisible in Light Mode!)
   - ✅ `className="text-2xl font-bold text-text-primary"` (Adapts to `#FFFFFF` in dark, `#111827` in light).

2. **NEVER hardcode `bg-bg-dark` or `bg-surface-dark`**:
   - ❌ `className="bg-bg-dark border border-border-dark"`
   - ✅ `className="bg-bg border border-border"`

3. **Always pair brand backgrounds with `text-on-brand`**:
   - ❌ `className="bg-brand text-black"`
   - ✅ `className="bg-brand text-on-brand"`

---

## 🛠 Enforcement Checklist for Developers
- [x] All page containers use `bg-bg text-text-primary`.
- [x] All card containers use `bg-surface border border-border`.
- [x] All form inputs use `bg-bg border border-border text-text-primary placeholder-text-muted`.
- [x] All badges use semantic tokens (`bg-brand/10 text-brand border border-brand/30` or `bg-surface-2 border border-border text-text-muted`).
