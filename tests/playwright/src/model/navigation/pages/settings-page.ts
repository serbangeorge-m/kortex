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

import type { Locator, Page } from '@playwright/test';

import { BasePage } from './base-page';

export const preferenceOptions = [
  'Appearance',
  'Editor',
  'Exit On Close',
  'Experimental (Status Bar Providers)',
  'Extensions',
  'Kubernetes',
  'Open Dev Tools',
  'Tasks',
  'Telemetry',
  'Terminal',
  'User Confirmation',
  'Window',
] as const;

export type PreferenceOption = (typeof preferenceOptions)[number];

export class SettingsPage extends BasePage {
  readonly resourcesTab: Locator;
  readonly cliToolsTab: Locator;
  readonly proxyTab: Locator;
  readonly preferencesTab: Locator;

  constructor(page: Page) {
    super(page);
    this.resourcesTab = page.getByRole('link', { name: 'Resources' });
    this.cliToolsTab = page.getByRole('link', { name: 'CLI' });
    this.proxyTab = page.getByRole('link', { name: 'Proxy' });
    this.preferencesTab = page.getByRole('link', { name: 'Preferences' });
  }

  async goToResources(): Promise<void> {
    await this.resourcesTab.click();
  }

  async goToCliTools(): Promise<void> {
    await this.cliToolsTab.click();
  }

  async goToProxy(): Promise<void> {
    await this.proxyTab.click();
  }

  async goToPreferences(): Promise<void> {
    await this.preferencesTab.click();
  }

  async selectPreference(option: PreferenceOption): Promise<void> {
    const preferencesNav = this.page.getByRole('navigation', { name: 'PreferencesNavigation' });
    await preferencesNav.getByRole('link', { name: option }).click();
    await this.page.getByText(option, { exact: true }).first().waitFor({ state: 'visible' });
  }
}
