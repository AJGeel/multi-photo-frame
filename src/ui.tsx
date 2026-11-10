"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { Tooltip } from "@base-ui/react/tooltip";
import { useId, useState, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Chevron, Minus, Plus } from "./icons";
import { keyLabel, useIsMac, useIsTouch } from "./platform";
import { usePreferences } from "./preferences";

/** Key chips. "mod", "shift", "alt" and "backspace" are named per platform. */
export function Keys({ keys }: { keys: string[] }) {
  const mac = useIsMac();
  const touch = useIsTouch();
  if (touch) return null;
  return (
    <span className="keys">
      {keys.map((key, i) => (
        <kbd key={`${key}-${i}`} className="kbd">
          {keyLabel(key, mac)}
        </kbd>
      ))}
    </span>
  );
}

/** Wraps one element in a tooltip. Opens after 500 ms (set on the provider), instantly when moving between buttons. */
export function Tip({ label, keys, children }: { label: ReactNode; keys?: string[]; children: ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8}>
          <Tooltip.Popup className="tip">
            {label}
            {keys && <Keys keys={keys} />}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

interface IconButtonProps extends Omit<ComponentProps<typeof BaseButton>, "children"> {
  /** Accessible name. Also the tooltip text unless `tip` is given. */
  label: string;
  tip?: ReactNode;
  keys?: string[];
  small?: boolean;
  children?: ReactNode;
}

export function IconButton({ label, tip, keys, small, className, children, ...rest }: IconButtonProps) {
  return (
    <Tip label={tip ?? label} keys={keys}>
      <BaseButton {...rest} focusableWhenDisabled aria-label={label} className={["ib", small ? "sm" : "", className].filter(Boolean).join(" ")}>
        {children}
      </BaseButton>
    </Tip>
  );
}

interface ButtonProps extends ComponentProps<typeof BaseButton> {
  variant?: "primary" | "secondary" | "ghost";
  compact?: boolean;
}

export function Button({ variant = "secondary", compact, className, ...rest }: ButtonProps) {
  const classes = ["btn", variant === "secondary" ? "" : `btn-${variant}`, compact ? "compact" : "", className];
  return <BaseButton {...rest} focusableWhenDisabled className={classes.filter(Boolean).join(" ")} />;
}

function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

interface NumberFieldProps {
  /** Accessible name of the input. */
  label: string;
  value: number;
  decimals: number;
  step: number;
  unit?: string;
  /** Shows the focus halo, used to point at a value that was clamped. */
  halo?: boolean;
  /** Adds minus and plus buttons inside the field. */
  stepper?: { less: string; more: string };
  /** Called with the typed value on blur or Enter, and with the stepped value for arrows and buttons. Clamping is the caller's job. */
  onCommit: (value: number) => void;
}

export function NumberField({ label, value, decimals, step, unit, halo, stepper, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value.toFixed(decimals);

  function commitDraft() {
    const parsed = draft === null ? null : parseNumber(draft);
    setDraft(null);
    if (parsed !== null) onCommit(parsed);
  }

  function nudge(direction: 1 | -1, big: boolean) {
    const base = (draft === null ? null : parseNumber(draft)) ?? value;
    const next = base + direction * step * (big ? 10 : 1);
    setDraft(null);
    onCommit(Number(next.toFixed(decimals)));
  }

  return (
    <span className="fld" data-halo={halo || undefined} data-stepper={stepper ? "" : undefined}>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        value={shown}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commitDraft();
          } else if (event.key === "Escape") {
            setDraft(null);
          } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            nudge(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
          }
        }}
      />
      {unit && <span className="u">{unit}</span>}
      {stepper && (
        <>
          <IconButton small label={stepper.less} onClick={() => nudge(-1, false)}>
            <Minus size={12} />
          </IconButton>
          <IconButton small label={stepper.more} onClick={() => nudge(1, false)}>
            <Plus size={12} />
          </IconButton>
        </>
      )}
    </span>
  );
}

/** A label above a control. */
export function Labeled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={["stack", className].filter(Boolean).join(" ")}>
      <span className="lbl">{label}</span>
      {children}
    </div>
  );
}

/** A collapsible sidebar section. Which ones are collapsed is remembered with the settings. */
export function SidebarSection({ id, title, meta, children }: { id: string; title: string; meta?: ReactNode; children: ReactNode }) {
  const collapsed = usePreferences((s) => s.collapsed[id] === true);
  const setCollapsed = usePreferences((s) => s.setCollapsed);
  const bodyId = useId();
  return (
    <section className="section">
      <button type="button" className="sec" aria-expanded={!collapsed} aria-controls={bodyId} onClick={() => setCollapsed(id, !collapsed)}>
        <Chevron size={12} className={collapsed ? "chev collapsed" : "chev"} />
        {title}
        {meta !== undefined && <span className="sec-meta num">{meta}</span>}
      </button>
      <div id={bodyId} className="section-body" data-collapsed={collapsed || undefined} inert={collapsed}>
        <div className="section-inner">{children}</div>
      </div>
    </section>
  );
}
