import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIco, pngSize } from "../../scripts/brand/ico";
import { brandMarkDataUri, brandMarkSvg } from "@/lib/brand-mark";

/** A syntactically valid PNG header (signature + IHDR width/height) is all the writer looks at. */
function fakePng(size: number, extra = 4): Buffer {
  const b = Buffer.alloc(24 + extra);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(size, 16);
  b.writeUInt32BE(size, 20);
  return b;
}

describe("buildIco", () => {
  it("writes a directory entry per image pointing at its PNG payload", () => {
    const a = fakePng(16, 1);
    const b = fakePng(256, 7);
    const ico = buildIco([
      { size: 16, png: a },
      { size: 256, png: b },
    ]);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    // first entry
    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt16LE(6 + 6)).toBe(32);
    expect(ico.readUInt32LE(6 + 8)).toBe(a.length);
    expect(ico.readUInt32LE(6 + 12)).toBe(6 + 32);
    // 256 is stored as 0
    expect(ico.readUInt8(22)).toBe(0);
    expect(ico.readUInt32LE(22 + 12)).toBe(6 + 32 + a.length);
    expect(ico.subarray(6 + 32, 6 + 32 + a.length).equals(a)).toBe(true);
    expect(ico.length).toBe(6 + 32 + a.length + b.length);
  });

  it("rejects empty input, bad sizes and non-PNG payloads", () => {
    expect(() => buildIco([])).toThrow();
    expect(() => buildIco([{ size: 300, png: fakePng(300) }])).toThrow(/size/);
    expect(() => buildIco([{ size: 16, png: Buffer.from("not a png") }])).toThrow(/PNG/);
  });

  it("the committed favicon.ico holds 16, 32 and 48 px PNGs", () => {
    const ico = readFileSync("src/app/favicon.ico");
    expect(ico.readUInt16LE(4)).toBe(3);
    const sizes = [0, 1, 2].map((i) => {
      const e = 6 + 16 * i;
      const png = ico.subarray(ico.readUInt32LE(e + 12), ico.readUInt32LE(e + 12) + ico.readUInt32LE(e + 8));
      return pngSize(png).width;
    });
    expect(sizes).toEqual([16, 32, 48]);
  });
});

describe("pngSize", () => {
  it("reads IHDR dimensions and rejects non-PNG data", () => {
    expect(pngSize(fakePng(180))).toEqual({ width: 180, height: 180 });
    expect(() => pngSize(Buffer.alloc(24))).toThrow();
  });
});

describe("brandMarkSvg", () => {
  it("draws the glyph as paths (no text) on the brand gradient", () => {
    const svg = brandMarkSvg();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("#f58529");
    expect(svg).toContain("#515bd4");
    expect(svg).not.toContain("<text");
    expect(svg.match(/<path /g)).toHaveLength(3);
  });

  it("supports full-bleed variants and keeps icon.svg in sync", () => {
    expect(brandMarkSvg({ radius: 0 })).toContain('rx="0"');
    expect(readFileSync("src/app/icon.svg", "utf8").trim()).toBe(brandMarkSvg());
    expect(brandMarkDataUri()).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
