---
name: "Arc Neo Green"
colors:
  dark:
    backdrop: "rgba(0, 0, 0, 0.6)"
    background: "#050605"
    foreground: "#FCFCFC"
    muted: "#9EA19E"
    overlay: "#171917"
    surface: "#171917"
    surface-secondary: "#222422"
    surface-tertiary: "#262726"
    accent: "#50FF6C"
    accent-foreground: "#18181B"
    accent-hover: "#4DE565"
    accent-soft: "rgba(80, 255, 108, 0.15)"
    accent-soft-foreground: "#50FF6C"
    danger: "#FD3367"
    success: "#64C33A"
    warning: "#FF9C3E"
    border: "#282928"
    default: "#272827"
    focus: "#50FF6C"
    link: "#FCFCFC"
    scrollbar: "#9FA09F"
    segment: "#464746"
    separator: "#212221"
    field-background: "#171917"
    field-background-hover: "#1B1D1B"
    field-border: "#282928"
    field-border-focus: "#535353"
    field-border-hover: "#3A3B3A"
    field-foreground: "#FCFCFC"
    field-placeholder: "#9EA19E"
    black: "#000000"
    chart-1: "#00AE00"
    chart-2: "#00D641"
    chart-3: "#50FF6C"
    chart-4: "#80FF94"
    chart-5: "#80FF94"
    eclipse: "#18181B"
    snow: "#FCFCFC"
    white: "#FFFFFF"
    accent-soft-hover: "rgba(80, 255, 108, 0.2)"
    background-inverse: "#FCFCFC"
    background-secondary: "#0B0D0B"
    background-tertiary: "#131413"
    border-secondary: "#424342"
    border-tertiary: "#5B5D5B"
    danger-foreground: "#FCFCFC"
    danger-hover: "#FF5275"
    danger-soft: "rgba(253, 51, 103, 0.15)"
    danger-soft-foreground: "#FD3367"
    danger-soft-hover: "rgba(253, 51, 103, 0.2)"
    default-foreground: "#FCFCFC"
    default-hover: "#2E2F2E"
    field-focus: "#171917"
    overlay-foreground: "#FCFCFC"
    segment-foreground: "#FCFCFC"
    separator-secondary: "#333533"
    separator-tertiary: "#3B3D3B"
    success-foreground: "#18181B"
    success-hover: "#5CB03A"
    success-soft: "rgba(100, 195, 58, 0.15)"
    success-soft-foreground: "#64C33A"
    success-soft-hover: "rgba(100, 195, 58, 0.2)"
    surface-foreground: "#FCFCFC"
    surface-hover: "#262826"
    surface-secondary-foreground: "#FCFCFC"
    surface-tertiary-foreground: "#FCFCFC"
    warning-foreground: "#18181B"
    warning-hover: "#E58E3D"
    warning-soft: "rgba(255, 156, 62, 0.15)"
    warning-soft-foreground: "#FF9C3E"
    warning-soft-hover: "rgba(255, 156, 62, 0.2)"
  light:
    backdrop: "rgba(0, 0, 0, 0.5)"
    background: "#F4F5F4"
    foreground: "#18181B"
    muted: "#717371"
    overlay: "#FFFFFF"
    surface: "#FFFFFF"
    surface-secondary: "#EEF0EE"
    surface-tertiary: "#E9EBE9"
    # ADR 008 §决策四: light accent 降饱和 (chroma 0.237 → 0.18). authoritative value in global.css.
    accent: "oklch(84% 0.18 145.76)" # ≈ #5BD470, TBD Week 2 real-device review
    accent-foreground: "#18181B"
    accent-hover: "#4DE565"
    accent-soft: "rgba(80, 255, 108, 0.15)"
    accent-soft-foreground: "#18181B"
    danger: "#FD3367"
    success: "#64C33A"
    warning: "#FF9C3E"
    border: "#DDDEDD"
    default: "#EAEBEA"
    focus: "#50FF6C"
    link: "#18181B"
    scrollbar: "#D4D5D4"
    segment: "#FFFFFF"
    separator: "#E4E5E4"
    field-background: "#FFFFFF"
    field-background-hover: "#F9F9F9"
    field-border: "#DDDEDD"
    field-border-focus: "#ABABAC"
    field-border-hover: "#C6C7C7"
    field-foreground: "#18181B"
    field-placeholder: "#717371"
    black: "#000000"
    chart-1: "#00AE00"
    chart-2: "#00D641"
    chart-3: "#50FF6C"
    chart-4: "#80FF94"
    chart-5: "#80FF94"
    eclipse: "#18181B"
    snow: "#FCFCFC"
    white: "#FFFFFF"
    accent-soft-hover: "rgba(80, 255, 108, 0.2)"
    background-inverse: "#18181B"
    background-secondary: "#EAEBEA"
    background-tertiary: "#E0E1E0"
    border-secondary: "#C6C6C7"
    border-tertiary: "#A8A8A9"
    danger-foreground: "#FCFCFC"
    danger-hover: "#FF5275"
    danger-soft: "rgba(253, 51, 103, 0.15)"
    danger-soft-foreground: "#FD3367"
    danger-soft-hover: "rgba(253, 51, 103, 0.2)"
    default-foreground: "#18181B"
    default-hover: "#E0E1E1"
    field-focus: "#FFFFFF"
    overlay-foreground: "#18181B"
    segment-foreground: "#18181B"
    separator-secondary: "#D8D8D8"
    separator-tertiary: "#CDCDCE"
    success-foreground: "#18181B"
    success-hover: "#5CB03A"
    success-soft: "rgba(100, 195, 58, 0.15)"
    success-soft-foreground: "#64C33A"
    success-soft-hover: "rgba(100, 195, 58, 0.2)"
    surface-foreground: "#18181B"
    surface-hover: "#EAEAEA"
    surface-secondary-foreground: "#18181B"
    surface-tertiary-foreground: "#18181B"
    warning-foreground: "#18181B"
    warning-hover: "#E58E3D"
    warning-soft: "rgba(255, 156, 62, 0.15)"
    warning-soft-foreground: "#FF9C3E"
    warning-soft-hover: "rgba(255, 156, 62, 0.2)"
typography:
  xs:
    fontFamily: "Inter"
    fontSize: "12px"
    lineHeight: "16px"
  sm:
    fontFamily: "Inter"
    fontSize: "14px"
    lineHeight: "20px"
  base:
    fontFamily: "Inter"
    fontSize: "16px"
    lineHeight: "24px"
  lg:
    fontFamily: "Inter"
    fontSize: "18px"
    lineHeight: "28px"
  xl:
    fontFamily: "Inter"
    fontSize: "20px"
    lineHeight: "28px"
  2xl:
    fontFamily: "Inter"
    fontSize: "24px"
    lineHeight: "32px"
  3xl:
    fontFamily: "Inter"
    fontSize: "30px"
    lineHeight: "36px"
  4xl:
    fontFamily: "Inter"
    fontSize: "36px"
    lineHeight: "40px"
  5xl:
    fontFamily: "Inter"
    fontSize: "48px"
    lineHeight: "48px"
  6xl:
    fontFamily: "Inter"
    fontSize: "60px"
    lineHeight: "60px"
  7xl:
    fontFamily: "Inter"
    fontSize: "72px"
    lineHeight: "72px"
  8xl:
    fontFamily: "Inter"
    fontSize: "96px"
    lineHeight: "96px"
  9xl:
    fontFamily: "Inter"
    fontSize: "128px"
    lineHeight: "128px"
spacing:
  base: "4px"
  fieldBorderWidth: "0px"
rounded:
  field: "12px"
  radius: "8px"
elevation:
  field: "0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.06)"
  overlay: "0 2px 8px 0 rgba(0, 0, 0, 0.06), 0 -6px 12px 0 rgba(0, 0, 0, 0.03), 0 14px 28px 0 rgba(0, 0, 0, 0.08)"
  surface: "0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.06)"
components:
  button-danger:
    backgroundColor: "#FD3367"
    component: 'Button variant="danger"'
    textColor: "#FCFCFC"
  button-primary:
    backgroundColor: "#50FF6C"
    component: 'Button variant="primary"'
    textColor: "#18181B"
  card:
    backgroundColor: "#FFFFFF"
    component: "Card"
    shadow: "0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.06)"
  chart:
    series1: "#00AE00"
    series2: "#00D641"
    series3: "#50FF6C"
    series4: "#80FF94"
    series5: "#80FF94"
  field:
    backgroundColor: "#FFFFFF"
    borderColor: "#DDDEDD"
    borderWidth: "0px"
    radius: "12px"
    shadow: "0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.06)"
    textColor: "#18181B"
  overlay:
    backgroundColor: "#FFFFFF"
    component: "Modal, Popover, Dropdown, Sheet"
    shadow: "0 2px 8px 0 rgba(0, 0, 0, 0.06), 0 -6px 12px 0 rgba(0, 0, 0, 0.03), 0 14px 28px 0 rgba(0, 0, 0, 0.08)"
    textColor: "#18181B"
---

# Arc Neo Green

## Colors

Use semantic HeroUI tokens and Tailwind utilities in product code. The raw values below are resolved color values for each mode; component code should still use the same token name and let CSS resolve light or dark mode.

| Token                          | Light                      | Dark                       | Formula / source                                                        | HeroUI variable                  | Tailwind / component equivalent                                            | Purpose                                                                             |
| ------------------------------ | -------------------------- | -------------------------- | ----------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `backdrop`                     | `rgba(0, 0, 0, 0.5)`       | `rgba(0, 0, 0, 0.6)`       | `Light: oklch(0% 0 0 / 0.5); Dark: oklch(0% 0 0 / 0.6)`                 | `--backdrop`                     | Modal, drawer, and overlay backdrops                                       | Semi-transparent overlay rendered behind modals, drawers, and alert dialogs.        |
| `background`                   | `#F4F5F4`                  | `#050605`                  | `Light: oklch(97.02% 0.0020 145.76); Dark: oklch(12.00% 0.0020 145.76)` | `--background`                   | `bg-background`                                                            | Page-level base canvas. The foundational background of the interface.               |
| `foreground`                   | `#18181B`                  | `#FCFCFC`                  | `Light: = eclipse; Dark: = snow`                                        | `--foreground`                   | `text-foreground`                                                          | Primary text and icon color. Optimized for readability on backgrounds and surfaces. |
| `muted`                        | `#717371`                  | `#9EA19E`                  | `Light: oklch(55.17% 0.0040 145.76); Dark: oklch(70.50% 0.0040 145.76)` | `--muted`                        | `text-muted`                                                               | Secondary text color for less prominent content like placeholders and captions.     |
| `overlay`                      | `#FFFFFF`                  | `#171917`                  | `Light: = white; Dark: oklch(21.03% 0.0040 145.76)`                     | `--overlay`                      | `bg-overlay text-overlay-foreground` for floating panels                   | Background for modals, popovers, and floating panels.                               |
| `surface`                      | `#FFFFFF`                  | `#171917`                  | `Light: = white; Dark: oklch(21.03% 0.0040 145.76)`                     | `--surface`                      | `bg-surface text-surface-foreground` for cards and panels                  | Container background for cards, panels, modals, and dropdowns.                      |
| `surface-secondary`            | `#EEF0EE`                  | `#222422`                  | `Light: oklch(95.24% 0.0030 145.76); Dark: oklch(25.70% 0.0030 145.76)` | `--surface-secondary`            | `bg-surface-secondary` for subdued nested surfaces                         | Secondary surface for nested containers and layered panels.                         |
| `surface-tertiary`             | `#E9EBE9`                  | `#262726`                  | `Light: oklch(93.73% 0.0030 145.76); Dark: oklch(27.21% 0.0030 145.76)` | `--surface-tertiary`             | `bg-surface-tertiary` for low-emphasis nested surfaces                     | Tertiary surface for deeper nesting levels.                                         |
| `accent`                       | `#50FF6C`                  | `#50FF6C`                  | `oklch(88.15% 0.2375 145.76)`                                           | `--accent`                       | `Button variant="primary"` or `bg-accent text-accent-foreground`           | Primary brand color. Used for key actions, highlights, and moments of emphasis.     |
| `accent-foreground`            | `#18181B`                  | `#18181B`                  | `= eclipse`                                                             | `--accent-foreground`            | `text-accent-foreground` on accent surfaces                                | Text/icon color on accent backgrounds. Optimized for contrast and readability.      |
| `accent-hover`                 | `#4DE565`                  | `#4DE565`                  | `accent / 90% + accent-foreground / 10%`                                | `--accent-hover`                 | Prefer HeroUI hover states; use `bg-accent-hover` only for custom surfaces | Accent hover state. Derived automatically from accent and accent-foreground.        |
| `accent-soft`                  | `rgba(80, 255, 108, 0.15)` | `rgba(80, 255, 108, 0.15)` | `accent / 15% + transparent`                                            | `--accent-soft`                  | `bg-accent-soft text-accent-soft-foreground` for selected or soft emphasis | Subtle accent background. A low-opacity tint for soft emphasis and selections.      |
| `accent-soft-foreground`       | `#18181B`                  | `#50FF6C`                  | `Light: = foreground; Dark: = accent`                                   | `--accent-soft-foreground`       | Prefer the HeroUI token for accent-soft-foreground.                        | Text color on accent-soft backgrounds. Matches the accent color.                    |
| `danger`                       | `#FD3367`                  | `#FD3367`                  | `oklch(65.32% 0.2337 12.76)`                                            | `--danger`                       | `Button variant="danger"` or `text-danger` for destructive states          | Represents destructive, irreversible, or critical actions and states.               |
| `success`                      | `#64C33A`                  | `#64C33A`                  | `oklch(73.29% 0.1942 137.87)`                                           | `--success`                      | `text-success` or HeroUI success status components                         | Communicates positive outcomes, confirmations, and completion states.               |
| `warning`                      | `#FF9C3E`                  | `#FF9C3E`                  | `oklch(78.19% 0.1590 59.36)`                                            | `--warning`                      | `text-warning` for caution states                                          | Indicates caution or actions that require attention but are not destructive.        |
| `border`                       | `#DDDEDD`                  | `#282928`                  | `Light: oklch(90.00% 0.0020 145.76); Dark: oklch(28.00% 0.0020 145.76)` | `--border`                       | `border-border`                                                            | Default border color for containers and interactive elements.                       |
| `default`                      | `#EAEBEA`                  | `#272827`                  | `Light: oklch(94.00% 0.0020 145.76); Dark: oklch(27.40% 0.0020 145.76)` | `--default`                      | `bg-default text-default-foreground` for neutral controls                  | Neutral interactive background. Used for chips, tags, and secondary controls.       |
| `focus`                        | `#50FF6C`                  | `#50FF6C`                  | `= accent`                                                              | `--focus`                        | Keyboard focus rings                                                       | Focus ring color for keyboard navigation indicators.                                |
| `link`                         | `#18181B`                  | `#FCFCFC`                  | `= foreground`                                                          | `--link`                         | Link text color                                                            | Text color for interactive links.                                                   |
| `scrollbar`                    | `#D4D5D4`                  | `#9FA09F`                  | `Light: oklch(87.10% 0.0020 145.76); Dark: oklch(70.50% 0.0020 145.76)` | `--scrollbar`                    | Scrollbar thumb color                                                      | Scrollbar thumb color.                                                              |
| `segment`                      | `#FFFFFF`                  | `#464746`                  | `Light: = white; Dark: oklch(39.64% 0.0020 145.76)`                     | `--segment`                      | Segmented controls                                                         | Background for segmented controls.                                                  |
| `separator`                    | `#E4E5E4`                  | `#212221`                  | `Light: oklch(92.00% 0.0020 145.76); Dark: oklch(25.00% 0.0020 145.76)` | `--separator`                    | `border-separator` or HeroUI `Separator`                                   | Divider color for structuring content with subtle boundaries.                       |
| `field-background`             | `#FFFFFF`                  | `#171917`                  | `Light: = white; Dark: oklch(21.03% 0.0040 145.76)`                     | `--field-background`             | Use HeroUI field components rather than custom backgrounds                 | Background for text inputs, selects, and interactive fields.                        |
| `field-background-hover`       | `#F9F9F9`                  | `#1B1D1B`                  | `field-background / 90% + field-foreground / 2%`                        | `--field-background-hover`       | Prefer the HeroUI token for field-background-hover.                        | Hover state for form field backgrounds.                                             |
| `field-border`                 | `#DDDEDD`                  | `#282928`                  | `Light: oklch(90.00% 0.0020 145.76); Dark: oklch(28.00% 0.0020 145.76)` | `--field-border`                 | Use HeroUI field components or `border-field-border` for custom fields     | Border color for form fields. Transparent by default.                               |
| `field-border-focus`           | `#ABABAC`                  | `#535353`                  | `field-border / 74% + field-foreground / 22%`                           | `--field-border-focus`           | Prefer the HeroUI token for field-border-focus.                            | Focus state for form field borders.                                                 |
| `field-border-hover`           | `#C6C7C7`                  | `#3A3B3A`                  | `field-border / 88% + field-foreground / 10%`                           | `--field-border-hover`           | Prefer the HeroUI token for field-border-hover.                            | Hover state for form field borders.                                                 |
| `field-foreground`             | `#18181B`                  | `#FCFCFC`                  | `var(--foreground)`                                                     | `--field-foreground`             | Field text color                                                           | Text color inside form fields.                                                      |
| `field-placeholder`            | `#717371`                  | `#9EA19E`                  | `= muted`                                                               | `--field-placeholder`            | Field placeholder text color                                               | Placeholder text color in form fields.                                              |
| `black`                        | `#000000`                  | `#000000`                  | `oklch(0% 0 0)`                                                         | `--black`                        | Prefer the HeroUI token for black.                                         | Pure black. Used as a base primitive for dark theme foreground elements.            |
| `chart-1`                      | `#00AE00`                  | `#00AE00`                  | `oklch(from var(--accent) calc(l - 0.24) c h)`                          | `--chart-1`                      | First chart series color                                                   | Chart series color 1. Darkest accent-derived shade for multi-series visualizations. |
| `chart-2`                      | `#00D641`                  | `#00D641`                  | `oklch(from var(--accent) calc(l - 0.12) c h)`                          | `--chart-2`                      | Second chart series color                                                  | Chart series color 2. Mid-dark accent-derived shade.                                |
| `chart-3`                      | `#50FF6C`                  | `#50FF6C`                  | `= accent`                                                              | `--chart-3`                      | Primary chart series color, aligned with accent                            | Chart series color 3. Equal to accent — the brand baseline.                         |
| `chart-4`                      | `#80FF94`                  | `#80FF94`                  | `oklch(from var(--accent) calc(l + 0.12) c h)`                          | `--chart-4`                      | Fourth chart series color                                                  | Chart series color 4. Mid-light accent-derived tint.                                |
| `chart-5`                      | `#80FF94`                  | `#80FF94`                  | `oklch(from var(--accent) calc(l + 0.24) c h)`                          | `--chart-5`                      | Fifth chart series color                                                   | Chart series color 5. Lightest accent-derived tint.                                 |
| `eclipse`                      | `#18181B`                  | `#18181B`                  | `oklch(21.03% 0.0059 285.89)`                                           | `--eclipse`                      | Prefer the HeroUI token for eclipse.                                       | Near-black neutral. Slightly softer than pure black for dark surfaces.              |
| `snow`                         | `#FCFCFC`                  | `#FCFCFC`                  | `oklch(99.11% 0 0)`                                                     | `--snow`                         | Prefer the HeroUI token for snow.                                          | Off-white neutral. Slightly softer than pure white for backgrounds.                 |
| `white`                        | `#FFFFFF`                  | `#FFFFFF`                  | `oklch(100% 0 0)`                                                       | `--white`                        | Prefer the HeroUI token for white.                                         | Pure white. Used as a base primitive for light theme surfaces and backgrounds.      |
| `accent-soft-hover`            | `rgba(80, 255, 108, 0.2)`  | `rgba(80, 255, 108, 0.2)`  | `accent / 20% + transparent`                                            | `--accent-soft-hover`            | Prefer the HeroUI token for accent-soft-hover.                             | Hover state for accent-soft backgrounds.                                            |
| `background-inverse`           | `#18181B`                  | `#FCFCFC`                  | `= foreground`                                                          | `--background-inverse`           | Prefer the HeroUI token for background-inverse.                            | Inverted background, matches the foreground color.                                  |
| `background-secondary`         | `#EAEBEA`                  | `#0B0D0B`                  | `background / 96% + foreground / 4%`                                    | `--background-secondary`         | Prefer the HeroUI token for background-secondary.                          | Slightly tinted background for subtle contrast against the base canvas.             |
| `background-tertiary`          | `#E0E1E0`                  | `#131413`                  | `background / 92% + foreground / 8%`                                    | `--background-tertiary`          | Prefer the HeroUI token for background-tertiary.                           | More prominently tinted background for layered sections.                            |
| `border-secondary`             | `#C6C6C7`                  | `#424342`                  | `surface / 78% + surface-foreground / 22%`                              | `--border-secondary`             | Prefer the HeroUI token for border-secondary.                              | Medium-contrast border for stronger visual separation.                              |
| `border-tertiary`              | `#A8A8A9`                  | `#5B5D5B`                  | `surface / 66% + surface-foreground / 34%`                              | `--border-tertiary`              | Prefer the HeroUI token for border-tertiary.                               | High-contrast border for maximum definition.                                        |
| `danger-foreground`            | `#FCFCFC`                  | `#FCFCFC`                  | `= snow`                                                                | `--danger-foreground`            | Prefer the HeroUI token for danger-foreground.                             | Text/icon color on danger backgrounds.                                              |
| `danger-hover`                 | `#FF5275`                  | `#FF5275`                  | `danger / 90% + danger-foreground / 10%`                                | `--danger-hover`                 | Prefer the HeroUI token for danger-hover.                                  | Hover state for danger backgrounds.                                                 |
| `danger-soft`                  | `rgba(253, 51, 103, 0.15)` | `rgba(253, 51, 103, 0.15)` | `danger / 15% + transparent`                                            | `--danger-soft`                  | Prefer the HeroUI token for danger-soft.                                   | Subtle danger background for soft emphasis.                                         |
| `danger-soft-foreground`       | `#FD3367`                  | `#FD3367`                  | `= danger`                                                              | `--danger-soft-foreground`       | Prefer the HeroUI token for danger-soft-foreground.                        | Text color on danger-soft backgrounds.                                              |
| `danger-soft-hover`            | `rgba(253, 51, 103, 0.2)`  | `rgba(253, 51, 103, 0.2)`  | `danger / 20% + transparent`                                            | `--danger-soft-hover`            | Prefer the HeroUI token for danger-soft-hover.                             | Hover state for danger-soft backgrounds.                                            |
| `default-foreground`           | `#18181B`                  | `#FCFCFC`                  | `Light: = eclipse; Dark: = snow`                                        | `--default-foreground`           | Prefer the HeroUI token for default-foreground.                            | Text/icon color on default backgrounds.                                             |
| `default-hover`                | `#E0E1E1`                  | `#2E2F2E`                  | `default / 96% + default-foreground / 4%`                               | `--default-hover`                | Prefer the HeroUI token for default-hover.                                 | Hover state for default backgrounds.                                                |
| `field-focus`                  | `#FFFFFF`                  | `#171917`                  | `= field-background`                                                    | `--field-focus`                  | Prefer the HeroUI token for field-focus.                                   | Background for form fields in focus state.                                          |
| `overlay-foreground`           | `#18181B`                  | `#FCFCFC`                  | `= foreground`                                                          | `--overlay-foreground`           | Prefer the HeroUI token for overlay-foreground.                            | Text/icon color on overlay backgrounds.                                             |
| `segment-foreground`           | `#18181B`                  | `#FCFCFC`                  | `Light: = eclipse; Dark: = foreground`                                  | `--segment-foreground`           | Prefer the HeroUI token for segment-foreground.                            | Text color on segmented controls.                                                   |
| `separator-secondary`          | `#D8D8D8`                  | `#333533`                  | `surface / 85% + surface-foreground / 15%`                              | `--separator-secondary`          | Prefer the HeroUI token for separator-secondary.                           | Medium-contrast divider for visible section breaks.                                 |
| `separator-tertiary`           | `#CDCDCE`                  | `#3B3D3B`                  | `surface / 81% + surface-foreground / 19%`                              | `--separator-tertiary`           | Prefer the HeroUI token for separator-tertiary.                            | High-contrast divider for strong visual separation.                                 |
| `success-foreground`           | `#18181B`                  | `#18181B`                  | `= eclipse`                                                             | `--success-foreground`           | Prefer the HeroUI token for success-foreground.                            | Text/icon color on success backgrounds.                                             |
| `success-hover`                | `#5CB03A`                  | `#5CB03A`                  | `success / 90% + success-foreground / 10%`                              | `--success-hover`                | Prefer the HeroUI token for success-hover.                                 | Hover state for success backgrounds.                                                |
| `success-soft`                 | `rgba(100, 195, 58, 0.15)` | `rgba(100, 195, 58, 0.15)` | `success / 15% + transparent`                                           | `--success-soft`                 | Prefer the HeroUI token for success-soft.                                  | Subtle success background for soft emphasis.                                        |
| `success-soft-foreground`      | `#64C33A`                  | `#64C33A`                  | `= success`                                                             | `--success-soft-foreground`      | Prefer the HeroUI token for success-soft-foreground.                       | Text color on success-soft backgrounds.                                             |
| `success-soft-hover`           | `rgba(100, 195, 58, 0.2)`  | `rgba(100, 195, 58, 0.2)`  | `success / 20% + transparent`                                           | `--success-soft-hover`           | Prefer the HeroUI token for success-soft-hover.                            | Hover state for success-soft backgrounds.                                           |
| `surface-foreground`           | `#18181B`                  | `#FCFCFC`                  | `= foreground`                                                          | `--surface-foreground`           | Prefer the HeroUI token for surface-foreground.                            | Text/icon color on surface containers.                                              |
| `surface-hover`                | `#EAEAEA`                  | `#262826`                  | `surface / 92% + surface-foreground / 8%`                               | `--surface-hover`                | Prefer the HeroUI token for surface-hover.                                 | Hover state for surface containers.                                                 |
| `surface-secondary-foreground` | `#18181B`                  | `#FCFCFC`                  | `= foreground`                                                          | `--surface-secondary-foreground` | Prefer the HeroUI token for surface-secondary-foreground.                  | Text color on secondary surfaces.                                                   |
| `surface-tertiary-foreground`  | `#18181B`                  | `#FCFCFC`                  | `= foreground`                                                          | `--surface-tertiary-foreground`  | Prefer the HeroUI token for surface-tertiary-foreground.                   | Text color on tertiary surfaces.                                                    |
| `warning-foreground`           | `#18181B`                  | `#18181B`                  | `= eclipse`                                                             | `--warning-foreground`           | Prefer the HeroUI token for warning-foreground.                            | Text/icon color on warning backgrounds.                                             |
| `warning-hover`                | `#E58E3D`                  | `#E58E3D`                  | `warning / 90% + warning-foreground / 10%`                              | `--warning-hover`                | Prefer the HeroUI token for warning-hover.                                 | Hover state for warning backgrounds.                                                |
| `warning-soft`                 | `rgba(255, 156, 62, 0.15)` | `rgba(255, 156, 62, 0.15)` | `warning / 15% + transparent`                                           | `--warning-soft`                 | Prefer the HeroUI token for warning-soft.                                  | Subtle warning background for soft emphasis.                                        |
| `warning-soft-foreground`      | `#FF9C3E`                  | `#FF9C3E`                  | `= warning`                                                             | `--warning-soft-foreground`      | Prefer the HeroUI token for warning-soft-foreground.                       | Text color on warning-soft backgrounds.                                             |
| `warning-soft-hover`           | `rgba(255, 156, 62, 0.2)`  | `rgba(255, 156, 62, 0.2)`  | `warning / 20% + transparent`                                           | `--warning-soft-hover`           | Prefer the HeroUI token for warning-soft-hover.                            | Hover state for warning-soft backgrounds.                                           |

## Typography

Use the generated font and text scale through HeroUI components and Tailwind text utilities. The raw values below are normalized to px for design handoff.
| Token | Font family | Font size | Line height | HeroUI variable | Tailwind equivalent |
| --- | --- | --- | --- | --- | --- |
| `xs` | Inter | `12px` | `16px` | `--text-xs` | `text-xs` |
| `sm` | Inter | `14px` | `20px` | `--text-sm` | `text-sm` |
| `base` | Inter | `16px` | `24px` | `--text-base` | `text-base` |
| `lg` | Inter | `18px` | `28px` | `--text-lg` | `text-lg` |
| `xl` | Inter | `20px` | `28px` | `--text-xl` | `text-xl` |
| `2xl` | Inter | `24px` | `32px` | `--text-2xl` | `text-2xl` |
| `3xl` | Inter | `30px` | `36px` | `--text-3xl` | `text-3xl` |
| `4xl` | Inter | `36px` | `40px` | `--text-4xl` | `text-4xl` |
| `5xl` | Inter | `48px` | `48px` | `--text-5xl` | `text-5xl` |
| `6xl` | Inter | `60px` | `60px` | `--text-6xl` | `text-6xl` |
| `7xl` | Inter | `72px` | `72px` | `--text-7xl` | `text-7xl` |
| `8xl` | Inter | `96px` | `96px` | `--text-8xl` | `text-8xl` |
| `9xl` | Inter | `128px` | `128px` | `--text-9xl` | `text-9xl` |

### Font and Letter Spacing

| Token            | Raw value           | Formula / source | HeroUI variable          | Tailwind / component equivalent                                                 | Purpose                                                    |
| ---------------- | ------------------- | ---------------- | ------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `font sans`      | `var(--font-inter)` |                  | `--font-sans`            | Prefer inherited typography from HeroUI components and Tailwind font utilities. | Primary sans font family used by HeroUI components.        |
| `letter spacing` | `0em`               |                  | `--theme-letter-spacing` | Prefer Tailwind tracking utilities only when a local override is intentional.   | Global letter-spacing adjustment for generated text scale. |

## Layout

Layout should use Tailwind v4 spacing utilities and HeroUI component structure. Keep spacing semantic and consistent instead of copying raw `rem` values into components.

### Spacing and Sizing

| Token                      | Raw value | Formula / source | HeroUI variable        | Tailwind / component equivalent                                                 | Purpose                                                         |
| -------------------------- | --------- | ---------------- | ---------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `spacing`                  | `4px`     |                  | `--spacing`            | Prefer Tailwind spacing utilities like `gap-4`, `p-6`, `px-8`, and `space-y-4`. | Base spacing unit used by the generated Tailwind spacing scale. |
| `field border width`       | `0px`     |                  | `--border-width-field` | Prefer HeroUI field components; use this only for custom field implementations. | Border width used by form fields and field-like cells.          |
| `field border width alias` | `0px`     |                  | `--field-border-width` | Prefer `--border-width-field` for new CSS.                                      | Compatibility alias for field border width.                     |

## Elevation & Depth

Depth comes from HeroUI surface and overlay tokens. Prefer built-in component shadows such as `shadow-surface` and `shadow-overlay`; avoid stacking custom shadows on top of Card or overlay components.

### Shadows

| Token            | Raw value                                                                                                                                                      | Formula / source | HeroUI variable    | Tailwind / component equivalent                                                   | Purpose                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `surface shadow` | `0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.06)`                                                              |                  | `--surface-shadow` | Prefer HeroUI surfaces and `shadow-surface`; avoid stacking extra custom shadows. | Elevation shadow for cards and resting surfaces.                                  |
| `overlay shadow` | `Light: 0 2px 8px 0 rgba(0, 0, 0, 0.06), 0 -6px 12px 0 rgba(0, 0, 0, 0.03), 0 14px 28px 0 rgba(0, 0, 0, 0.08); Dark: 0 0 1px 0 rgba(255, 255, 255, 0.3) inset` |                  | `--overlay-shadow` | Prefer HeroUI overlay components and `shadow-overlay`.                            | Elevation shadow for floating layers such as popovers, menus, modals, and sheets. |
| `field shadow`   | `0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.06)`                                                              |                  | `--field-shadow`   | Prefer HeroUI field components.                                                   | Subtle elevation treatment for inputs and field-like controls.                    |

## Shapes

Use HeroUI's default rounded shape language and Tailwind radius utilities. Custom components should match the same radius scale rather than introducing unrelated corner values.

### Radius

| Token          | Raw value | Formula / source | HeroUI variable  | Tailwind / component equivalent                                                      | Purpose                                                                       |
| -------------- | --------- | ---------------- | ---------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `radius`       | `8px`     |                  | `--radius`       | Prefer Tailwind radius utilities like `rounded-lg`, `rounded-xl`, and `rounded-2xl`. | Global corner radius basis for surfaces, buttons, and container shapes.       |
| `field radius` | `12px`    |                  | `--field-radius` | Prefer HeroUI field components so this radius is applied automatically.              | Corner radius basis for inputs, selects, text areas, and other form controls. |

## Components

- **Buttons:** Use HeroUI Button semantic variants. Primary actions use `variant="primary"`; alternatives use `secondary`, `tertiary`, `outline`, or `ghost`; destructive actions use `danger` or `danger-soft`.
- **Cards and surfaces:** Use HeroUI Card, Surface, overlays, and `bg-surface` tokens. Do not add extra custom shadows to components that already include surface elevation.
- **Forms:** Use HeroUI field components so `--field-background`, `--field-border`, `--field-foreground`, `--field-radius`, and field widths resolve consistently.
- **Status:** Use semantic status tokens for actual meaning: success for positive outcomes, warning for caution, danger for destructive or critical states.
- **Charts:** Use `--chart-1` through `--chart-5` for multi-series charts; `--chart-3` aligns to the accent baseline.

## Do's and Don'ts

- Do use semantic HeroUI and Tailwind tokens as implementation handles; use raw values in this file for reference, QA, and migration only.
- Do use the same semantic token across light and dark mode; do not branch component code to manually pick colors.
- Do keep layouts spacious but controlled with consistent spacing, constrained max widths, and comfortable reading lines on wide screens.
- Do maintain a clear general-to-specific hierarchy: summaries and primary actions first, detail and supplementary content later.
- Do keep page and section spacing on a consistent 4px/8px rhythm; avoid doubling parent and child padding in the same direction.
- Do size containers to their content; avoid excess fixed heights, oversized sections, and layouts that stretch wider than their content warrants.
- Do align sibling items consistently so cards, sections, names, prices, metrics, and controls start from the same visual anchors.
- Do use neutral surface tokens for containers, cards, stat pills, and nested panels; reserve accent and status colors for real meaning.
- Do create hierarchy with surface levels, spacing, typography, and content order before adding more borders or decoration.
- Do use accent for primary emphasis and success, warning, and danger only for their semantic meanings.
- Do keep typography concise and scannable with short Title Case headings, muted secondary text, and tabular numbers for metrics.
- Do keep descriptions and supporting text short; aim for two or three lines so content stays easy to scan.
- Do visually align large numbers, prices, temperatures, and metrics with their supporting labels using tight line-height and optical adjustment.
- Do use elevation deliberately with tokenized surface and overlay shadows; avoid stacking extra custom shadows on elevated components.
- Do align nested surfaces, images, and custom containers to the same radius scale as the theme.
- Do keep inner and outer radii visually related; inner media should feel contained by the parent surface.
- Do prefer spacing, grouping, and hierarchy before adding separators, borders, icons, or decorative wrappers.
- Do use separators sparingly and only where they communicate structure; use spacing for ordinary grouping.
- Do keep icons purposeful, semantically colored, and subordinate to text unless they carry real meaning.
- Do make active, selected, and applied states persistent and visible without replacing the controls that created them.
- Do keep interactive targets comfortable and accessible, especially icon-only actions and touch-facing controls.
- Do reserve hover feedback for interactive elements; display-only content should not imply interactivity.
- Don't copy raw hex, shadow, radius, or spacing values into product code when a semantic token or Tailwind utility exists.
- Don't overuse accent colors, warning colors, decorative icons, borders, or shadows to create visual interest.
- Don't mix inconsistent radius scales, padding systems, or sibling card treatments in the same view.
- Don't duplicate the same information in multiple visual forms unless each form adds distinct value.
- Don't use color alone to create hierarchy when spacing, type scale, surface level, or content order would communicate it more clearly.
- Don't place progress bars, meters, or decorative strips on card edges; keep status indicators inside the content flow.
- Don't nest visually heavy surfaces inside other heavy surfaces; avoid card-on-card depth unless hierarchy truly needs it.
- Don't let badges, chips, tags, or compact indicators stretch full width; they should remain content-sized.
- Don't add redundant icons, logos, badges, wrappers, or trust signals that do not introduce new information.
- Don't use ALL CAPS labels or verbose headings when short Title Case labels communicate the section clearly.
- Don't misuse warning for neutral emphasis or decoration; reserve it for genuine caution.
- Don't allow floating controls to overlap content; add enough spacing or padding for close buttons, badges, and overlay actions.
- Don't add hover or transition behavior to non-interactive content; reserve feedback for actual interactions.
