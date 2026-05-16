import { spawn } from 'node:child_process';

function spawnAndWait(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: process.platform !== 'win32',
      stdio: 'ignore'
    });

    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

export async function openBrowser(url: string): Promise<void> {
  if (process.platform === 'darwin') {
    await spawnAndWait('open', [url]);
    return;
  }

  if (process.platform === 'win32') {
    await spawnAndWait('cmd', ['/c', 'start', '', url]);
    return;
  }

  await spawnAndWait('xdg-open', [url]);
}
