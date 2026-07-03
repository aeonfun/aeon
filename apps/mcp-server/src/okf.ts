/**
 * OKF exchange surface for the Aeon MCP server.
 *
 * Aeon's memory/topics/ directory is a native OKF (Open Knowledge Format) v0.1
 * knowledge bundle. This module projects it — plus the skill catalog, rendered as
 * `type: Skill` concepts — over MCP as read-only resources, so any consumption
 * agent can traverse Aeon's knowledge without cloning the repo:
 *
 *   okf://index          — synthesized bundle index (§6 progressive disclosure)
 *   okf://concept/{id}    — one topic concept's raw markdown ({id} = path under topics/)
 *   okf://skill/{slug}    — one Aeon skill rendered as an OKF Skill concept
 *
 * Read-only, zero new deps. The index is synthesized on the fly (§6 explicitly
 * permits consumers to build one), so it never goes stale here.
 */

import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";
import type { Skill } from "./skill-executor.js";

const RESERVED = new Set(["index.md", "log.md"]);
const OKF_VERSION = "0.1";

export interface OkfResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

interface Concept {
  id: string; // path under topics/, no .md
  file: string; // absolute path
  type: string;
  title: string;
  description: string;
}

// Concept roots served over MCP. Knowledge surfaces here; operational OKF files
// (logs, issues, docs) are conformant but intentionally not published in the
// index — serving every log would defeat progressive disclosure (§6).
function conceptRoots(repoRoot: string): { dir: string; prefix: string }[] {
  return [
    { dir: join(repoRoot, "memory", "topics"), prefix: "" },
    { dir: join(repoRoot, "output", "articles"), prefix: "articles/" },
  ];
}

function walkMd(dir: string): string[] {
  let out: string[] = [];
  let entries: import("fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkMd(p));
    else if (e.isFile() && e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

/** Minimal, dependency-free frontmatter field reader (mirrors scripts/okf-*.mjs). */
function parseFrontmatter(content: string): Record<string, string> {
  const text = content.replace(/^﻿/, "");
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  const fields: Record<string, string> = {};
  if (!m) return fields;
  for (const line of m[1].split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (km) fields[km[1]] = (km[2] ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
  }
  return fields;
}

/** Load every OKF concept from memory/topics/ (reserved files excluded). */
export function loadConcepts(repoRoot: string): Concept[] {
  const concepts: Concept[] = [];
  for (const { dir, prefix } of conceptRoots(repoRoot)) {
    for (const file of walkMd(dir)) {
      const base = file.slice(file.lastIndexOf("/") + 1);
      if (RESERVED.has(base)) continue;
      const fm = parseFrontmatter(readFileSync(file, "utf-8"));
      const rel = relative(dir, file).split("\\").join("/");
      concepts.push({
        id: prefix + rel.replace(/\.md$/, ""),
        file,
        type: fm.type || "Untyped",
        title: fm.title || rel.replace(/\.md$/, ""),
        description: fm.description || "",
      });
    }
  }
  return concepts.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Render one Aeon skill as an OKF `Skill` concept document. Scheduling is
 * per-deployment operator config (aeon.yml), deliberately not in the catalog, so
 * it is not asserted here — this concept describes the capability, not the cadence.
 */
function skillToConcept(skill: Skill): string {
  return [
    "---",
    "type: Skill",
    `title: ${skill.name}`,
    `description: ${skill.description}`,
    `tags: [${skill.category}]`,
    `resource: skills/${skill.slug}/SKILL.md`,
    "---",
    "",
    `# ${skill.name}`,
    "",
    skill.description,
    "",
    `- Category: ${skill.category}`,
    `- Variable: ${skill.var ? skill.var : "none"}`,
    `- Definition: \`skills/${skill.slug}/SKILL.md\``,
    "",
  ].join("\n");
}

/** Synthesize the bundle index (OKF §6) over concepts + skills. */
function buildIndex(concepts: Concept[], skills: Skill[]): string {
  const byType = new Map<string, Concept[]>();
  for (const c of concepts) {
    if (!byType.has(c.type)) byType.set(c.type, []);
    byType.get(c.type)!.push(c);
  }
  let body = `---\nokf_version: "${OKF_VERSION}"\n---\n\n# Knowledge — Aeon OKF bundle\n\n`;
  body += `Native OKF v${OKF_VERSION} bundle served over MCP. Concepts live in \`memory/topics/\`; skills are projected from the catalog.\n`;

  for (const type of [...byType.keys()].sort()) {
    body += `\n# ${type}\n\n`;
    const entries = byType.get(type)!.sort((a, b) => a.title.localeCompare(b.title));
    for (const c of entries) {
      body += c.description
        ? `* [${c.title}](okf://concept/${c.id}) - ${c.description}\n`
        : `* [${c.title}](okf://concept/${c.id})\n`;
    }
  }

  if (skills.length) {
    body += `\n# Skill\n\n`;
    for (const s of [...skills].sort((a, b) => a.slug.localeCompare(b.slug))) {
      body += `* [${s.name}](okf://skill/${s.slug}) - ${s.description}\n`;
    }
  }
  return body;
}

/** List all OKF resources exposed by the server. */
export function listOkfResources(repoRoot: string, skills: Skill[]): OkfResource[] {
  const concepts = loadConcepts(repoRoot);
  const resources: OkfResource[] = [
    {
      uri: "okf://index",
      name: "OKF bundle index",
      description: "Synthesized index of Aeon's OKF knowledge bundle (concepts + skills).",
      mimeType: "text/markdown",
    },
  ];
  for (const c of concepts) {
    resources.push({
      uri: `okf://concept/${c.id}`,
      name: `${c.type}: ${c.title}`,
      description: c.description,
      mimeType: "text/markdown",
    });
  }
  for (const s of skills) {
    resources.push({
      uri: `okf://skill/${s.slug}`,
      name: `Skill: ${s.name}`,
      description: s.description,
      mimeType: "text/markdown",
    });
  }
  return resources;
}

/** Resolve one OKF resource URI to its markdown, or null if unknown. */
export function readOkfResource(
  repoRoot: string,
  uri: string,
  skills: Skill[]
): { mimeType: string; text: string } | null {
  if (uri === "okf://index") {
    return { mimeType: "text/markdown", text: buildIndex(loadConcepts(repoRoot), skills) };
  }
  const conceptMatch = uri.match(/^okf:\/\/concept\/(.+)$/);
  if (conceptMatch) {
    const id = conceptMatch[1];
    const concept = loadConcepts(repoRoot).find((c) => c.id === id);
    if (!concept) return null;
    return { mimeType: "text/markdown", text: readFileSync(concept.file, "utf-8") };
  }
  const skillMatch = uri.match(/^okf:\/\/skill\/(.+)$/);
  if (skillMatch) {
    const skill = skills.find((s) => s.slug === skillMatch[1]);
    if (!skill) return null;
    return { mimeType: "text/markdown", text: skillToConcept(skill) };
  }
  return null;
}
