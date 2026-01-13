const LANGUAGES = [
  { code: 'auto', name: '自动检测' },
  { code: 'zh', name: '中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
];

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  showAuto?: boolean;
}

export function LanguageSelector({ value, onChange, showAuto = true }: LanguageSelectorProps) {
  const options = showAuto ? LANGUAGES : LANGUAGES.filter(l => l.code !== 'auto');

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 bg-[var(--bg-secondary)] rounded-lg border border-transparent
                 focus:border-[var(--accent)] focus:outline-none text-sm cursor-pointer"
    >
      {options.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}

export { LANGUAGES };
