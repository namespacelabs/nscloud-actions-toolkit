# AGENTS.md

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm run typecheck    # Type check
pnpm run lint         # Lint
pnpm run lint:fix     # Lint and fix
pnpm run format       # Format code
pnpm run format:check # Check formatting
pnpm run test         # Run tests in watch mode
pnpm run test:run     # Run tests once

# Build
pnpm run build        # Build for production
pnpm run clean        # Clean dist folder
```

## Project Structure

- `src/spacectl/` - spacectl installer module
  - Tests are co-located with implementation (e.g., `installer.ts` + `installer.test.ts`)
- Package exports:
  - `@namespacelabs/actions-toolkit` - Main entry
  - `@namespacelabs/actions-toolkit/spacectl` - spacectl installer

## Notes

- The binary is currently named `space` (releases at `namespacelabs/space`), but will be renamed to `spacectl`
- Folder structure uses `spacectl` in anticipation of the rename
- Uses pnpm as package manager
- Dual ESM/CJS build with tsdown
