"use client";

import { Select } from "@base-ui/react/select";
import { Check, Chevron } from "./icons";
import { findPreset, PRESET_GROUPS } from "./presets";
import { Keys } from "./ui";

interface SizePickerProps {
  size: { width: number; height: number };
  onPick: (presetId: string) => void;
}

/** The trigger looks like a field. Dimensions show portrait, as printed on the sizes. */
export function SizePicker({ size, onPick }: SizePickerProps) {
  const current = findPreset(size);
  const group = PRESET_GROUPS.find((g) => g.presets.some((p) => p.id === current?.id));
  return (
    <Select.Root value={current?.id ?? null} onValueChange={(id) => id !== null && onPick(id)}>
      <Select.Trigger className="fld size-trigger" aria-label="Size preset">
        <span className="size-name">
          <span className="size-main">{current?.label ?? "Custom"}</span>
          {group && <span className="size-group">{group.label}</span>}
        </span>
        <Select.Icon className="size-icon">
          <Chevron size={12} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} alignItemWithTrigger={false} className="select-positioner">
          <Select.Popup className="pop select-pop">
            <Select.List className="select-list">
              {PRESET_GROUPS.map((g) => (
                <Select.Group key={g.label}>
                  <Select.GroupLabel className="group-label">{g.label}</Select.GroupLabel>
                  {g.presets.map((p) => (
                    <Select.Item key={p.id} value={p.id} className="mi">
                      <span className="mi-check">
                        <Select.ItemIndicator>
                          <Check size={14} />
                        </Select.ItemIndicator>
                      </span>
                      <Select.ItemText className="mi-name">{p.label}</Select.ItemText>
                      <span className="mi-dims num">
                        {p.width} × {p.height}
                      </span>
                    </Select.Item>
                  ))}
                </Select.Group>
              ))}
            </Select.List>
            <div className="select-foot">
              <span>Type any width and height for Custom</span>
              <Keys keys={["↑", "↓", "↵"]} />
            </div>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
