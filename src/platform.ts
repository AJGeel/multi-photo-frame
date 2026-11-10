import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True on Apple platforms. The server and the first client render say false, so Ctrl is shown until hydration. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
}

/** Subscribes to a media query. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const NARROW_QUERY = "(max-width: 899px)";

/** Phones and tablets: no hover, a finger for a pointer, and usually no hardware keyboard. */
export const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

export function useIsTouch(): boolean {
  return useMediaQuery(TOUCH_QUERY);
}

/** Key names shown on chips: "mod" becomes the platform's modifier. */
export function keyLabel(key: string, mac: boolean): string {
  switch (key) {
    case "mod":
      return mac ? "⌘" : "Ctrl";
    case "shift":
      return mac ? "⇧" : "Shift";
    case "alt":
      return mac ? "⌥" : "Alt";
    case "backspace":
      return mac ? "⌫" : "Backspace";
    default:
      return key;
  }
}

export function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}
