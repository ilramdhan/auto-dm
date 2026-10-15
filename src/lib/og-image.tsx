import { ImageResponse } from "next/og";
import { BRAND_GRADIENT, brandMarkDataUri, THEME_COLORS } from "@/lib/brand-mark";
import { OG_SIZE, SITE } from "@/lib/seo";

/**
 * Shared by src/app/opengraph-image.tsx and src/app/twitter-image.tsx (1200x630), and by
 * scripts/brand/banner.tsx for the GitHub social preview (1280x640). The layout is fluid, so any
 * size close to 2:1 works.
 */

const gradient = `linear-gradient(135deg, ${BRAND_GRADIENT.map((s) => `${s.color} ${s.offset * 100}%`).join(", ")})`;

export function renderOgImage(size: { width: number; height: number } = OG_SIZE): ImageResponse {
  const logo = brandMarkDataUri();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        backgroundColor: THEME_COLORS.dark,
        backgroundImage:
          "radial-gradient(circle at 85% 0%, rgba(129, 52, 175, 0.55), transparent 55%), radial-gradient(circle at 0% 100%, rgba(245, 133, 41, 0.28), transparent 50%)",
        color: "#fafafa",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>. */}
        <img src={logo} width={96} height={96} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{SITE.name}</div>
          <div style={{ fontSize: 24, color: "#b9b9c6" }}>Instagram comment-to-DM automation</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 1000 }}>
          {SITE.headline}
        </div>
        <div style={{ fontSize: 28, color: "#cfcfda" }}>{SITE.tagline}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {["Open source · MIT", "Self-hosted", "n8n ready"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                fontSize: 22,
                padding: "8px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255, 255, 255, 0.22)",
                color: "#e4e4ec",
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          style={{ display: "flex", width: 160, height: 10, borderRadius: 999, backgroundImage: gradient }}
        />
      </div>
    </div>,
    { ...size },
  );
}
