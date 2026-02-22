# AGENTS.md - Developer Guidelines for Prayer Timings

## Project Overview
This is a vanilla JavaScript project (no build system, no npm) for calculating Islamic prayer times. It consists of:
- `app.js` - Main application logic (744 lines)
- `index.html` - HTML structure
- `styles.css` - CSS styling

## Commands

### Running the Project
Simply open `index.html` in a browser. No build step required.

### Linting
No formal linter is configured. Keep code clean and consistent with existing style.

### Testing
No test framework is set up. Manually verify changes by:
1. Opening `index.html` in a browser
2. Testing prayer time calculations against known values
3. Checking UI updates when changing inputs

## Code Style Guidelines

### JavaScript Conventions

#### Naming
- **Classes**: PascalCase (e.g., `PrayTime`, `CityData`)
- **Functions**: camelCase (e.g., `buildRows`, `formatHijriDate`)
- **Variables**: camelCase (e.g., `lat`, `lng`, `times`)
- **Static Constants**: UPPER_SNAKE_CASE (e.g., `PrayTime.Jafari`, `PrayTime.Makkah`)
- **Boolean variables**: Prefix with `is`, `has`, `should` (e.g., `isToday`, `hasError`)

#### Formatting
- Use 2-space indentation
- Use double quotes for strings (except where unnecessary)
- Use template literals for string interpolation: `` `Hello ${name}` ``
- Use semicolons at statement ends
- Maximum line length: ~100 characters (soft limit)
- Use trailing commas in arrays and objects

#### Imports/Dependencies
- No module system - all code in single `app.js`
- Avoid adding external dependencies
- Use browser native APIs (localStorage, Date, etc.)

#### Types
- Use primitive types: `number`, `string`, `boolean`
- Use `null` for intentional absence, `undefined` for uninitialized
- Validate numeric inputs: `Number.isNaN()`, `Number.isFinite()`
- Parse strings with radix: `parseInt(value, 10)`, `parseFloat(value)`

#### Error Handling
- Use try/catch for localStorage operations
- Return `null` or default values on error rather than throwing
- Validate inputs early with guard clauses
- Handle NaN/Infinity in calculations gracefully

#### Functions
- Keep functions small and focused (single responsibility)
- Use early returns to reduce nesting
- Prefer pure functions where possible
- Document complex calculations with comments

#### Class Design
- Use static properties for constants
- Use instance properties for configuration
- Keep public API minimal (setters/getters as needed)
- Use private fields (#field) for true encapsulation if needed

### CSS Conventions

#### Structure
- Use 2-space indentation
- Define CSS custom properties in `:root`
- Use BEM-like naming: `.block__element--modifier`
- Group related styles together

#### Properties
- Use shorthand properties where appropriate
- Use `rem` for font sizes, `px` for borders/shadows
- Use `flex` and `grid` for layouts
- Define mobile styles first, then `@media (min-width: ...)` for larger screens

#### Accessibility
- Include `aria-label` on form elements
- Use semantic HTML elements
- Ensure color contrast meets WCAG standards

### HTML Conventions
- Use semantic elements (`<header>`, `<main>`, `<section>`)
- Include `lang` attribute on `<html>`
- Use `aria-label` for form controls
- Keep markup clean and readable

## File Organization

```
/project-root
  app.js        # Main application logic
  index.html    # HTML structure
  styles.css    # Styling
```

## Common Tasks

### Adding a New City
Add to the `cities` array in `app.js`:
```javascript
{ name: "CityName", lat: 0.0, lng: 0.0, method: PrayTime.Makkah }
```

### Adding a Calculation Method
1. Add static constant to `PrayTime` class
2. Add method parameters to `methodParams` object in constructor

### Modifying UI
- Input controls are in `index.html` lines 13-60
- Styling is in `styles.css` (chip, bar, card classes)
- Event listeners are in the `init()` IIFE at bottom of `app.js`

## Notes
- The prayer time calculation logic is ported from Lua - verify calculations match expected outputs
- Settings persist in localStorage under key `iftar-timetable-settings`
- Times default to 12-hour format with AM/PM suffix
