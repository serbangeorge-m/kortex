/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
import { expect, test } from '../fixtures/electron-app';
import { NavigationBar } from '../model/navigation/navigation';
import { preferenceOptions, SettingsPage } from '../model/navigation/pages/settings-page';

let navigationBar: NavigationBar;
let settingsPage: SettingsPage;

test.beforeEach(async ({ page }) => {
  navigationBar = new NavigationBar(page);
  settingsPage = new SettingsPage(page);
  await navigationBar.settingsLink.click();
});

test.describe('Settings page navigation', { tag: '@smoke' }, () => {
  test('[TC-01] All settings tabs are visible', async () => {
    await expect(settingsPage.resourcesTab).toBeVisible();
    await expect(settingsPage.cliToolsTab).toBeVisible();
    await expect(settingsPage.proxyTab).toBeVisible();
    await expect(settingsPage.preferencesTab).toBeVisible();
  });

  test('[TC-02] Preferences submenu items are visible and can be interacted with', async ({ page }) => {
    await settingsPage.goToPreferences();
    const preferencesNav = page.getByRole('navigation', { name: 'PreferencesNavigation' });

    for (const option of preferenceOptions) {
      await expect(preferencesNav.getByRole('link', { name: option })).toBeVisible();
      await settingsPage.selectPreference(option);
    }
  });

  test('[TC-03] CLI tab shows goose CLI tool', async ({ page }) => {
    await settingsPage.goToCliTools();
    await expect(page.getByLabel('cli-name')).toBeVisible();
    await expect(page.getByLabel('cli-name')).toHaveText('goose');
  });
});
