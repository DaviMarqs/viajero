import { Calendar } from "lucide-react";
import { SelectField } from "./select-field";

interface InputDropdownProps {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  icon?: "calendar" | "none";
  placeholder?: string;
}

export default function InputDropdown({ label, hint, required, value, onChange, options, icon = "none", placeholder = "Selecione" }: InputDropdownProps) {
  const currentOption = value && !options.some(option => option.value === value)
    ? [{ value, label: icon === "calendar" && label === "Dura\u00e7\u00e3o ideal" ? `${value} dias` : value }]
    : [];
  return <SelectField
    label={label}
    hint={hint}
    required={required}
    optional={!required}
    icon={icon === "calendar" ? <Calendar className="size-4" aria-hidden="true" /> : undefined}
    value={value}
    onChange={onChange}
    options={[{ value: "", label: placeholder, disabled: true }, ...currentOption, ...options]}
  />;
}
