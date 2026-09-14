import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizePathSeparators,
  getCrossPlatformBasename,
  resolveLocalPath,
  getDisplayLocalPath,
} from "../path-utils";

describe("path-utils", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      LOCAL_WORKSPACE_PATH: "/workspace",
      LOCAL_HOST_WORKSPACE: "C:/workspace",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("normalizePathSeparators", () => {
    it("converts backslashes to forward slashes", () => {
      expect(normalizePathSeparators("C:\\workspace\\project")).toBe("C:/workspace/project");
      expect(normalizePathSeparators("foo\\bar\\baz")).toBe("foo/bar/baz");
    });

    it("handles empty or nullish strings", () => {
      expect(normalizePathSeparators("")).toBe("");
    });
  });

  describe("getCrossPlatformBasename", () => {
    it("extracts basename from Windows path", () => {
      expect(getCrossPlatformBasename("C:\\workspace\\chess-report")).toBe("chess-report");
      expect(getCrossPlatformBasename("C:\\workspace\\chess-report\\")).toBe("chess-report");
    });

    it("extracts basename from POSIX path", () => {
      expect(getCrossPlatformBasename("/workspace/chess-report")).toBe("chess-report");
      expect(getCrossPlatformBasename("/workspace/chess-report/")).toBe("chess-report");
    });

    it("extracts basename from simple name", () => {
      expect(getCrossPlatformBasename("chess-report")).toBe("chess-report");
    });
  });

  describe("resolveLocalPath", () => {
    it("maps Windows path C:\\workspace\\... to /workspace/...", () => {
      const resolved = resolveLocalPath("C:\\workspace\\chess-report");
      expect(resolved).toBe("/workspace/chess-report");
    });

    it("maps lowercase Windows path c:/workspace/... to /workspace/...", () => {
      const resolved = resolveLocalPath("c:/workspace/chess-report");
      expect(resolved).toBe("/workspace/chess-report");
    });

    it("handles workspace/project relative path", () => {
      const resolved = resolveLocalPath("workspace/chess-report");
      expect(resolved).toBe("/workspace/chess-report");
    });

    it("preserves /workspace/project as is", () => {
      const resolved = resolveLocalPath("/workspace/chess-report");
      expect(resolved).toBe("/workspace/chess-report");
    });
  });

  describe("getDisplayLocalPath", () => {
    it("converts /workspace/project to C:\\workspace\\project", () => {
      expect(getDisplayLocalPath("/workspace/chess-report")).toBe("C:\\workspace\\chess-report");
    });

    it("preserves paths outside /workspace", () => {
      expect(getDisplayLocalPath("/tmp/other-project")).toBe("/tmp/other-project");
    });
  });
});
