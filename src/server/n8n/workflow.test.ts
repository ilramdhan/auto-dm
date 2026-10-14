import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import raw from "../../../n8n/auto-reply-ig.workflow.json";
import { APP_URL_PLACEHOLDER, buildN8nWorkflow } from "./workflow";

type Wf = {
  nodes: { id: string; name: string; type: string }[];
  connections: Record<string, { main: { node: string }[][] }>;
};

describe("n8n workflow template", () => {
  const wf = raw as unknown as Wf;

  it("has unique node names and ids", () => {
    expect(new Set(wf.nodes.map((n) => n.name)).size).toBe(wf.nodes.length);
    expect(new Set(wf.nodes.map((n) => n.id)).size).toBe(wf.nodes.length);
  });

  it("only connects existing nodes", () => {
    const names = new Set(wf.nodes.map((n) => n.name));
    for (const [from, c] of Object.entries(wf.connections)) {
      expect(names.has(from)).toBe(true);
      for (const outs of c.main) for (const t of outs) expect(names.has(t.node)).toBe(true);
    }
  });

  it("enables raw body on the POST webhook", () => {
    expect(JSON.stringify(raw)).toContain('"rawBody":true');
  });
});

describe("buildN8nWorkflow", () => {
  it("replaces the placeholder (and trims trailing slash)", () => {
    const out = buildN8nWorkflow({ appUrl: "https://app.example.com/" });
    const s = JSON.stringify(out);
    expect(s).not.toContain(APP_URL_PLACEHOLDER);
    expect(s).toContain('"https://app.example.com"');
    expect(s).not.toContain('https://app.example.com/"');
  });

  it("returns a deep copy", () => {
    const a = buildN8nWorkflow({ appUrl: "https://a.test" });
    const b = buildN8nWorkflow({ appUrl: "https://b.test" });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(JSON.stringify(raw)).toContain(APP_URL_PLACEHOLDER);
  });

  it("embeds no secrets", () => {
    const s = JSON.stringify(buildN8nWorkflow({ appUrl: "https://a.test" }));
    expect(s).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{8,}/);
    expect(s).toContain("REPLACE_ME");
  });
});
