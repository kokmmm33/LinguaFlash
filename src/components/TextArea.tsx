interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

export function TextArea({ value, onChange, placeholder, readOnly, className = '' }: TextAreaProps) {
  return (
    <div className={`relative ${className}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full h-full min-h-[120px] p-3 bg-[var(--bg-secondary)] rounded-lg resize-none
                   border border-transparent focus:border-[var(--accent)] focus:outline-none
                   placeholder:text-[var(--text-secondary)]"
      />
      {value && !readOnly && (
        <button
          onClick={() => onChange('')}
          className="absolute top-2 right-2 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
        >
          <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
