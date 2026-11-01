import { useId, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Select } from "radix-ui";

interface SelectFieldProps {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  value: string | number;
  onChange: (value: string) => void;
  options: { value: string | number; label: string; disabled?: boolean }[];
}

const EMPTY_VALUE = "__all__";

export function SelectField({ label, icon, disabled, required, optional, hint, value, onChange, options }: SelectFieldProps) {
  const id = useId();
  return <div className="form-label">
    <label id={id} className="app-select-label">{icon}{label}{optional && <span className="text-muted-foreground">(opcional)</span>}</label>
    <Select.Root value={String(value) || EMPTY_VALUE} disabled={disabled} required={required} onValueChange={next => onChange(next === EMPTY_VALUE ? "" : next)}>
      <Select.Trigger className="app-select-trigger" aria-labelledby={id} aria-describedby={hint ? `${id}-hint` : undefined}>
        <Select.Value className="app-select-value" />
        <Select.Icon><ChevronDown className="size-4" aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="app-select-content" position="popper" sideOffset={4} align="start">
          <Select.Viewport className="app-select-viewport">
            {options.map(option => <Select.Item key={option.value} value={String(option.value) || EMPTY_VALUE} disabled={option.disabled} className="app-select-item">
              <Select.ItemText className="app-select-item-text">{option.label}</Select.ItemText>
              <Select.ItemIndicator className="app-select-item-indicator"><Check className="size-4" aria-hidden="true" /></Select.ItemIndicator>
            </Select.Item>)}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
    {hint && <p id={`${id}-hint`} className="field-support">{hint}</p>}
  </div>;
}
