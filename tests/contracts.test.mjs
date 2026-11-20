import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
test('all UI keys exist in English, French and German', () => {
  const locale = (lang) => JSON.parse(fs.readFileSync(new URL(`web/locales/${lang}.json`, root)));
  const keys = Object.keys(locale('en')).sort();
  for (const lang of ['de', 'fr']) assert.deepEqual(Object.keys(locale(lang)).sort(), keys);
});
test('overrides preserve base exports and do not copy core implementations', () => {
  for (const file of [
    'packages/backend/src/services/ble.js',
    'packages/frontend/src/components/settings/DeviceList.jsx',
  ]) {
    const source = fs.readFileSync(new URL(`overrides/${file}`, root), 'utf8');
    assert.match(source, /export \* from '@base'/);
    assert.ok(source.split('\n').length < 25);
  }
});
