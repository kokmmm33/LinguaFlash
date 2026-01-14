import { useState, useRef, useEffect } from 'react';
import { pauseShortcuts, resumeShortcuts } from '../services/shortcut';

interface ShortcutInputProps {
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  otherShortcut?: string;
  defaultValue: string;
  allShortcuts: { translate: string; showWindow: string };
}

// 解析快捷键字符串为显示格式
function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return shortcut
    .replace('CommandOrControl', isMac ? '⌘' : 'Ctrl')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace(/\+/g, ' ');
}

// 将键盘事件转换为快捷键字符串
function eventToShortcut(e: KeyboardEvent): string | null {
  // 忽略单独的修饰键
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return null;
  }

  const parts: string[] = [];

  if (e.metaKey || e.ctrlKey) {
    parts.push('CommandOrControl');
  }
  if (e.shiftKey) {
    parts.push('Shift');
  }
  if (e.altKey) {
    parts.push('Alt');
  }

  // 必须有修饰键
  if (parts.length === 0) {
    return null;
  }

  // 转换主键
  let key = e.key.toUpperCase();
  if (e.code.startsWith('Key')) {
    key = e.code.replace('Key', '');
  } else if (e.code.startsWith('Digit')) {
    key = e.code.replace('Digit', '');
  } else if (e.code === 'Space') {
    key = 'Space';
  } else if (e.code.startsWith('F') && /^F\d+$/.test(e.code)) {
    key = e.code;
  } else {
    // 其他特殊键
    const keyMap: Record<string, string> = {
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'Enter': 'Enter',
      'Tab': 'Tab',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'Escape': 'Escape',
    };
    key = keyMap[e.key] || e.key.toUpperCase();
  }

  parts.push(key);
  return parts.join('+');
}

// 检查是否为系统保留快捷键
function isReservedShortcut(shortcut: string): boolean {
  const reserved = [
    'CommandOrControl+C',
    'CommandOrControl+V',
    'CommandOrControl+X',
    'CommandOrControl+A',
    'CommandOrControl+Z',
    'CommandOrControl+Q',
    'CommandOrControl+W',
    'CommandOrControl+N',
    'CommandOrControl+O',
    'CommandOrControl+S',
    'CommandOrControl+P',
  ];
  return reserved.includes(shortcut);
}

export function ShortcutInput({ value, onChange, onReset, otherShortcut, defaultValue, allShortcuts }: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [tempValue, setTempValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const displayValue = tempValue ?? value;
  const hasConflict = otherShortcut && displayValue === otherShortcut;
  const isDefault = value === defaultValue;

  // 开始录入时暂停全局快捷键，结束时恢复
  useEffect(() => {
    if (isRecording) {
      pauseShortcuts().catch(console.error);
    } else {
      // 恢复快捷键
      resumeShortcuts(allShortcuts.translate, allShortcuts.showWindow).catch(console.error);
    }
  }, [isRecording, allShortcuts]);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Esc 取消录入
      if (e.key === 'Escape') {
        setIsRecording(false);
        setTempValue(null);
        setError(null);
        return;
      }

      const shortcut = eventToShortcut(e);
      if (!shortcut) return;

      // 检查系统保留
      if (isReservedShortcut(shortcut)) {
        setError('此快捷键为系统保留');
        return;
      }

      setError(null);
      setTempValue(shortcut);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // 当释放所有修饰键时，确认录入
      if (tempValue && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      if (tempValue && !isReservedShortcut(tempValue)) {
        onChange(tempValue);
        setIsRecording(false);
        setTempValue(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [isRecording, tempValue, onChange]);

  // 点击外部取消录入
  useEffect(() => {
    if (!isRecording) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsRecording(false);
        setTempValue(null);
        setError(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRecording]);

  return (
    <div className="flex items-center gap-2">
      <div
        ref={inputRef}
        onClick={() => setIsRecording(true)}
        className={`
          px-3 py-2 min-w-[180px] rounded-lg border cursor-pointer
          font-mono text-sm transition-colors
          ${isRecording
            ? 'border-[var(--accent)] bg-[var(--accent)]/10'
            : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--accent)]'
          }
          ${hasConflict ? 'border-yellow-500' : ''}
          ${error ? 'border-red-500' : ''}
        `}
      >
        {isRecording ? (
          <span className="text-[var(--text-secondary)]">请按下快捷键...</span>
        ) : (
          formatShortcut(displayValue)
        )}
      </div>

      {!isDefault && (
        <button
          onClick={onReset}
          className="px-2 py-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          重置
        </button>
      )}

      {hasConflict && (
        <span className="text-yellow-500 text-sm">与其他快捷键冲突</span>
      )}
      {error && (
        <span className="text-red-500 text-sm">{error}</span>
      )}
    </div>
  );
}
