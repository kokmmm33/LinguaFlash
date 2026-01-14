import { invoke } from '@tauri-apps/api/core';

export async function updateShortcuts(translate: string, showWindow: string): Promise<void> {
  await invoke('update_shortcuts', {
    translate,
    showWindow,
  });
}
