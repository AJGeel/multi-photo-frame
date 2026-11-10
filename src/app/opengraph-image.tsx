/* oxlint-disable next/no-img-element -- ImageResponse (satori) renders plain <img>; next/image does not apply. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "../site";

export const dynamic = "force-static";
export const alt = `${SITE_NAME} – many photos, one printable frame`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Fonts are bundled in the repo (also used by the UI) (SIL Open Font License) so the build never needs the network. */
const font = (file: string) => readFile(join(process.cwd(), "src/app/fonts", file));

/** Stock architecture photos from Unsplash (free to use under the Unsplash licence), resized to 560px and bundled. */
const PHOTO_FILES = ["orange-curves.jpg", "glass-tower.jpg", "teal-lattice.jpg", "apartments.jpg"];

const CELL_WIDTH = 138;
const CELL_HEIGHT = 144;
const GAP = 13;

/** A filled cell shows a photo. A cell without one is blank, with a dashed outline and its number, ready to fill. */
function Cell({ index, photo }: { index: number; photo?: string }) {
  const base = { display: "flex", width: CELL_WIDTH, height: CELL_HEIGHT, position: "relative" as const };
  if (photo) {
    return (
      <div style={{ ...base, overflow: "hidden" }}>
        <img src={photo} alt="" width={CELL_WIDTH} height={CELL_HEIGHT} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div style={{ ...base, background: "#f2f2f4", border: "2px dashed #c6c7ce" }}>
      <div style={{ display: "flex", position: "absolute", left: 12, top: 8, fontSize: 20, fontWeight: 500, color: "#6b6d75", fontFamily: "Inter" }}>{index}</div>
    </div>
  );
}

const FRAME = 30;
const FRAME_WIDTH = 480 + 2 * FRAME;
const FRAME_HEIGHT = 2 * CELL_HEIGHT + GAP + 40 + 2 * FRAME;

/** Moulding profile of the black frame (same stops as the preview in frames.css): dark outer edge, bright bevel, body, dark inner lip. */
const PROFILE = [
  [0, "#000"],
  [0.12, "#3a3a3d"],
  [0.45, "#141415"],
  [0.88, "#080808"],
  [1, "#2a2a2c"],
] as const;

/** Each side is a mitred trapezoid, with its own gradient direction and light/dark shade, so the corners show a diagonal split. */
const SIDES = [
  { id: "top", points: `0,0 ${FRAME_WIDTH},0 ${FRAME_WIDTH - FRAME},${FRAME} ${FRAME},${FRAME}`, grad: [0, 0, 0, 1], shade: "rgba(255,255,255,0.16)" },
  { id: "bottom", points: `${FRAME},${FRAME_HEIGHT - FRAME} ${FRAME_WIDTH - FRAME},${FRAME_HEIGHT - FRAME} ${FRAME_WIDTH},${FRAME_HEIGHT} 0,${FRAME_HEIGHT}`, grad: [0, 1, 0, 0], shade: "rgba(0,0,0,0.34)" },
  { id: "left", points: `0,0 ${FRAME},${FRAME} ${FRAME},${FRAME_HEIGHT - FRAME} 0,${FRAME_HEIGHT}`, grad: [0, 0, 1, 0], shade: "rgba(255,255,255,0.06)" },
  { id: "right", points: `${FRAME_WIDTH},0 ${FRAME_WIDTH},${FRAME_HEIGHT} ${FRAME_WIDTH - FRAME},${FRAME_HEIGHT - FRAME} ${FRAME_WIDTH - FRAME},${FRAME}`, grad: [1, 0, 0, 0], shade: "rgba(0,0,0,0.22)" },
] as const;

function FrameMoulding() {
  return (
    <svg width={FRAME_WIDTH} height={FRAME_HEIGHT} viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        {SIDES.map(({ id, grad: [x1, y1, x2, y2] }) => (
          <linearGradient key={id} id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
            {PROFILE.map(([offset, color]) => (
              <stop key={offset} offset={offset} stopColor={color} />
            ))}
          </linearGradient>
        ))}
      </defs>
      {SIDES.map(({ id, points, shade }) => (
        <g key={id}>
          <polygon points={points} fill={`url(#${id})`} />
          <polygon points={points} fill={shade} />
        </g>
      ))}
    </svg>
  );
}

const dataUri = async (file: string) => `data:image/jpeg;base64,${(await readFile(join(process.cwd(), "src/app/og-photos", file))).toString("base64")}`;

export default async function Image() {
  const photos = await Promise.all(PHOTO_FILES.map(dataUri));
  const [serif, medium, semibold] = await Promise.all([
    font("instrument-serif-latin-400-normal.woff"),
    font("inter-latin-500-normal.woff"),
    font("inter-latin-600-normal.woff"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 84px",
          color: "#e8e9ec",
          fontFamily: "Inter",
          background: "radial-gradient(ellipse 55% 85% at 74% 50%, #5e4220 0%, #2c1f10 45%, #0d0b09 100%)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 420 }}>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 600, letterSpacing: 4, color: "#fdb844", textTransform: "uppercase" }}>Free · In your browser</div>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Instrument Serif", fontSize: 108, lineHeight: 0.95, marginTop: 22, letterSpacing: -2 }}>
            <span>Multi Photo</span>
            <span style={{ fontStyle: "normal", color: "#a4a7b0" }}>Frame</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: "#a4a7b0", marginTop: 30, lineHeight: 1.4 }}>Arrange many photos in one print-ready frame.</div>
        </div>

        {/* The framed picture */}
        <div
          style={{
            display: "flex",
            position: "relative",
            padding: FRAME,
            background: "#080808",
            boxShadow: "0 0 0 2px rgba(255,225,185,0.24), 0 0 90px rgba(252,163,17,0.3), 14px 26px 60px rgba(0,0,0,0.7), 4px 8px 14px rgba(0,0,0,0.5)",
          }}
        >
          <FrameMoulding />
          <div style={{ display: "flex", flexDirection: "column", gap: GAP, padding: 20, width: 480, background: "#fbfbfa", boxShadow: "inset 3px 5px 12px rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", gap: GAP }}>
              <Cell index={1} photo={photos[0]} />
              <Cell index={2} photo={photos[1]} />
              <Cell index={3} photo={photos[2]} />
            </div>
            <div style={{ display: "flex", gap: GAP }}>
              <Cell index={4} photo={photos[3]} />
              <Cell index={5} />
              <Cell index={6} />
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Serif", data: serif, weight: 400, style: "normal" },
        { name: "Inter", data: medium, weight: 500, style: "normal" },
        { name: "Inter", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
