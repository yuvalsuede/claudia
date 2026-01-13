import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let testDbPath: string | null = null;

export function setupTestDb(): string {
  const tempDir = mkdtempSync(join(tmpdir(), "claudia-test-"));
  testDbPath = join(tempDir, "test.db");
  process.env.CLAUDIA_DB = testDbPath;
  return testDbPath;
}

export function cleanupTestDb(): void {
  if (testDbPath) {
    try {
      const dir = join(testDbPath, "..");
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    testDbPath = null;
    delete process.env.CLAUDIA_DB;
  }
}

export function getTestDbPath(): string | null {
  return testDbPath;
}
