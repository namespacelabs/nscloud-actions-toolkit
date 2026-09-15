import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("spacectl imports", () => {
  it.each(["", '{"action":"open'])(
    "does not parse an incomplete event payload %j",
    async (payload) => {
      const directory = await mkdtemp(join(tmpdir(), "spacectl-event-"));
      try {
        const eventPath = join(directory, "event.json");
        await writeFile(eventPath, payload);
        vi.stubEnv("GITHUB_EVENT_PATH", eventPath);
        vi.resetModules();

        const spacectl = await import("./index");
        expect(spacectl.install).toBeTypeOf("function");
        expect(spacectl.exec).toBeTypeOf("function");
      } finally {
        vi.unstubAllEnvs();
        await rm(directory, { recursive: true, force: true });
      }
    }
  );
});
