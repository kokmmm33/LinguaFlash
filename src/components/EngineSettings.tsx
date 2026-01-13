import { useState } from 'react';
import { EngineConfig, testEngineConnection } from '../services/translation';

const GLM_MODELS = [
  { value: 'glm-4-flash', label: 'GLM-4-Flash (快速)' },
  { value: 'glm-4', label: 'GLM-4 (标准)' },
  { value: 'glm-4-plus', label: 'GLM-4-Plus (增强)' },
];

interface EngineSettingsProps {
  config: EngineConfig;
  isDefault: boolean;
  canDelete: boolean;
  onUpdate: (config: EngineConfig) => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

export function EngineSettings({
  config,
  isDefault,
  canDelete,
  onUpdate,
  onDelete,
  onSetDefault,
}: EngineSettingsProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const success = await testEngineConnection(config);
      setTestResult(success ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const engineName = config.engine_type === 'ollama' ? 'Ollama' : '智谱 GLM';

  return (
    <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{engineName}</span>
          {isDefault && (
            <span className="text-xs px-2 py-0.5 bg-[var(--accent)] text-white rounded">
              默认
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <button
              onClick={onSetDefault}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              设为默认
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="text-sm text-red-500 hover:underline"
            >
              删除
            </button>
          )}
        </div>
      </div>

      {config.engine_type === 'ollama' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              服务地址
            </label>
            <input
              type="text"
              value={config.endpoint || ''}
              onChange={(e) => onUpdate({ ...config, endpoint: e.target.value })}
              placeholder="http://localhost:11434"
              className="w-full px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)]
                         focus:border-[var(--accent)] focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              模型名称
            </label>
            <input
              type="text"
              value={config.model || ''}
              onChange={(e) => onUpdate({ ...config, model: e.target.value })}
              placeholder="qwen2"
              className="w-full px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)]
                         focus:border-[var(--accent)] focus:outline-none text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              API Key
            </label>
            <input
              type="password"
              value={config.api_key || ''}
              onChange={(e) => onUpdate({ ...config, api_key: e.target.value })}
              placeholder="输入你的 API Key"
              className="w-full px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)]
                         focus:border-[var(--accent)] focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              模型
            </label>
            <select
              value={config.model || 'glm-4-flash'}
              onChange={(e) => onUpdate({ ...config, model: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)]
                         focus:border-[var(--accent)] focus:outline-none text-sm cursor-pointer"
            >
              {GLM_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-4 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm
                     hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {testing ? '测试中...' : '测试连接'}
        </button>
        {testResult === 'success' && (
          <span className="text-sm text-green-500">连接成功</span>
        )}
        {testResult === 'error' && (
          <span className="text-sm text-red-500">连接失败</span>
        )}
      </div>
    </div>
  );
}
