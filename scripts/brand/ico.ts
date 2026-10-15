/**
 * Minimal ICO container writer with PNG-compressed entries (supported by every browser since
 * Windows Vista / IE7). Layout: ICONDIR (6 bytes), one ICONDIRENTRY (16 bytes) per image, then the
 * PNG payloads back to back.
 */

export type IcoImage = { size: number; png: Uint8Array };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function buildIco(images: readonly IcoImage[]): Buffer {
  if (images.length === 0) throw new Error("ICO needs at least one image");
  const headerSize = 6 + 16 * images.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize;
  images.forEach(({ size, png }, i) => {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error(`Invalid icon size ${size}`);
    if (!PNG_SIGNATURE.every((b, j) => png[j] === b)) throw new Error(`Entry ${size} is not a PNG`);
    const e = 6 + 16 * i;
    header.writeUInt8(size === 256 ? 0 : size, e); // width (0 means 256)
    header.writeUInt8(size === 256 ? 0 : size, e + 1); // height
    header.writeUInt8(0, e + 2); // palette colours
    header.writeUInt8(0, e + 3); // reserved
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(png.length, e + 8); // payload size
    header.writeUInt32LE(offset, e + 12); // payload offset
    offset += png.length;
  });

  return Buffer.concat([header, ...images.map((img) => Buffer.from(img.png))]);
}

/** Reads width/height from a PNG's IHDR chunk. */
export function pngSize(png: Uint8Array): { width: number; height: number } {
  if (!PNG_SIGNATURE.every((b, j) => png[j] === b)) throw new Error("Not a PNG");
  const view = Buffer.from(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.readUInt32BE(16), height: view.readUInt32BE(20) };
}
