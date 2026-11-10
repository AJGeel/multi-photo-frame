export const SITE_NAME = "Multi Photo Frame";
export const SITE_TITLE = "Multi Photo Frame – Combine many photos into one printable frame";
export const SITE_DESCRIPTION =
  "Free photo collage maker for gallery walls. Arrange many photos in one grid, pick a frame, and export a print-ready image at 300 DPI. Private: everything runs in your browser.";

/** Public address of the deployed site. Set NEXT_PUBLIC_SITE_URL at build time, or OG and sitemap links point at localhost. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
