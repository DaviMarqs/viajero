interface InputTextareaProps {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export default function InputTextarea({
  label,
  hint,
  required,
  value,
  onChange,
  placeholder = "",
  rows = 3,
}: InputTextareaProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <textarea
        className="min-h-32 w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:shadow-[0_0_0_4px_rgba(46,140,255,0.12)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />

      {hint && (
        <p className="flex items-start gap-2 text-sm leading-6 text-slate-500">
          <span className="text-slate-400">i</span> {hint}
        </p>
      )}
    </div>
  );
}
