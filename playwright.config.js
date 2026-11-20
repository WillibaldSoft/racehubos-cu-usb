import { defineConfig } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.RACEHUBOS_HOST;
if (!host) throw new Error('Set RACEHUBOS_HOST to the RaceHubOS checkout used for UI tests');
const addons = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-cu-usb-tests-'));
fs.symlinkSync(root, path.join(addons, 'cu-usb'), 'junction');
process.once('exit', () => fs.rmSync(addons, { recursive: true, force: true }));
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.js',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5189',
    launchOptions: { executablePath: process.env.RACEHUBOS_TEST_BROWSER || undefined },
  },
  webServer: {
    command: `"${process.execPath}" "${path.join(host, 'node_modules/vite/bin/vite.js')}" --host 127.0.0.1 --port 5189 --strictPort`,
    cwd: path.join(host, 'packages/frontend'),
    url: 'http://127.0.0.1:5189',
    reuseExistingServer: false,
    env: { RACEHUBOS_ADDONS_DIR: addons },
  },
});
