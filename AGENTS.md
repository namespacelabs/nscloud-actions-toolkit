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

# CI validation (run after generating code)
pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run test:run
```

## Project Structure

- `src/spacectl/` - spacectl installer module
  - Tests are co-located with implementation (e.g., `installer.ts` + `installer.test.ts`)
- Package exports:
  - `@namespacelabs/actions-toolkit` - Main entry
  - `@namespacelabs/actions-toolkit/spacectl` - spacectl installer

## Testing Philosophy

- **Real tests** for pure functions and current platform detection - no mocks needed
- **Mocks only** for external I/O (`@actions/exec`, `@actions/tool-cache`, `@actions/io`)
- Extract pure functions (e.g., `getDownloadUrl`) to enable testing without mocks
- Prefer `vi.spyOn()` over `vi.mock()` when possible for more targeted mocking
- ESM limitation: cannot spy on `node:os` exports, so platform tests verify real behavior only
- **Pragmatism over purity**: it's acceptable to mock internal modules when testing complex orchestration functions (e.g., `install()`) to avoid excessive test setup

## Notes

- The binary is currently named `space` (releases at `namespacelabs/space`), but will be renamed to `spacectl`
- Folder structure uses `spacectl` in anticipation of the rename
- Uses pnpm as package manager
- Dual ESM/CJS build with tsdown
