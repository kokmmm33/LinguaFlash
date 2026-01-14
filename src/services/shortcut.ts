import { invoke } from '@tauri-apps/api/core';

export async function updateShortcuts(translate: string, showWindow: string): Promise<void> {
  await invoke('update_shortcuts', {
    translate,
    showWindow,
  });
}

export async function pauseShortcuts(): Promise<void> {
  await invoke('pause_shortcuts');
}

export async function resumeShortcuts(translate: string, showWindow: string): Promise<void> {
  await invoke('resume_shortcuts', {
    translate,
    showWindow,
  });
}
