import { test } from "node:test";
import assert from "node:assert/strict";
import { isMissingFileError } from "./github";

test("a local ENOENT and a GitHub 404 mean the file is missing", () => {
  const enoent = Object.assign(new Error("ENOENT: no such file, open '.mcp.json'"), { code: "ENOENT" });
  assert.equal(isMissingFileError(enoent), true);
  assert.equal(isMissingFileError(new Error("GitHub API 404: failed to read .mcp.json")), true);
});

test("auth, server and permission errors do not mean the file is missing", () => {
  assert.equal(isMissingFileError(new Error("GitHub API 401: failed to read .mcp.json")), false);
  assert.equal(isMissingFileError(new Error("GitHub API 403: failed to read .mcp.json")), false);
  assert.equal(isMissingFileError(new Error("GitHub API 502: failed to read .mcp.json")), false);
  assert.equal(isMissingFileError(Object.assign(new Error("EACCES"), { code: "EACCES" })), false);
  assert.equal(isMissingFileError("GitHub API 404: not an Error"), false);
});
