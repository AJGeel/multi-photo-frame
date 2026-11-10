import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  stroke?: number;
  className?: string;
}

function icon(paths: ReactNode, defaults: { stroke?: number } = {}) {
  return function Icon({ size = 16, stroke = defaults.stroke ?? 1.4, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        {paths}
      </svg>
    );
  };
}

export const Plus = icon(<path d="M8 3v10M3 8h10" />, { stroke: 1.5 });
export const Minus = icon(<path d="M3.5 8h9" />, { stroke: 1.6 });
export const Trash = icon(
  <>
    <path d="M3 4.5h10" />
    <path d="M6.5 4.5V3h3v1.5" />
    <path d="M4.5 4.5l.6 8.5h5.8l.6-8.5" />
  </>,
);
export const Undo = icon(
  <>
    <path d="M6 4 3 7l3 3" />
    <path d="M3 7h6.5a3.5 3.5 0 0 1 0 7H8" />
  </>,
);
export const Redo = icon(
  <>
    <path d="m10 4 3 3-3 3" />
    <path d="M13 7H6.5a3.5 3.5 0 0 0 0 7H8" />
  </>,
);
export const Download = icon(
  <>
    <path d="M8 2.5v8" />
    <path d="m4.5 7 3.5 3.5L11.5 7" />
    <path d="M3 13.5h10" />
  </>,
  { stroke: 1.5 },
);
export const Upload = icon(
  <>
    <path d="M8 10.5v-8" />
    <path d="M4.5 6 8 2.5 11.5 6" />
    <path d="M3 13.5h10" />
  </>,
);
export const Chevron = icon(<path d="m4 6 4 4 4-4" />, { stroke: 1.6 });
export const Check = icon(<path d="m3.5 8.5 3 3 6-7" />, { stroke: 1.8 });
export const Close = icon(<path d="m4 4 8 8M12 4l-8 8" />, { stroke: 1.6 });
export const Rotate = icon(
  <>
    <path d="M3 5.5h9.5L10 3" />
    <path d="M13 10.5H3.5L6 13" />
  </>,
);
export const Reset = icon(
  <>
    <path d="M2.5 3v3.5H6" />
    <path d="M3 9.5A5 5 0 1 0 4.2 4.6L2.5 6.5" />
  </>,
);
export const Dice = icon(
  <>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
    <path d="M5.6 5.6v.01M10.4 5.6v.01M8 8v.01M5.6 10.4v.01M10.4 10.4v.01" strokeWidth="1.9" />
  </>,
);
export const Settings = icon(
  <>
    <path d="M2.5 5h7M12.5 5h1M2.5 11h1M6.5 11h7" />
    <circle cx="11" cy="5" r="1.5" />
    <circle cx="5" cy="11" r="1.5" />
  </>,
);
export const Warning = icon(
  <>
    <path d="M8 2.5 14 13H2L8 2.5Z" />
    <path d="M8 6.5v3" />
    <path d="M8 11.3v.2" />
  </>,
);
export const Info = icon(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.2V11" />
    <path d="M8 5v.2" />
  </>,
);
export const AlertCircle = icon(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3.5" />
    <path d="M8 10.8v.2" />
  </>,
);
export const Laptop = icon(
  <>
    <rect x="3" y="3.5" width="10" height="7" rx="1" />
    <path d="M1.5 12.5h13" />
  </>,
);
export const Logo = icon(
  <>
    <rect x="2" y="2" width="12" height="12" rx="1" />
    <rect x="4.75" y="4.75" width="6.5" height="6.5" />
  </>,
);
export const Spinner = ({ size = 14 }: { size?: number }) => (
  <svg className="spin" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <path d="M8 2a6 6 0 1 1-6 6" />
  </svg>
);
