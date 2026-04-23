/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import { expect, type Locator, type Page } from '@playwright/test';
import { TIMEOUTS } from 'src/model/core/types';

import { BasePage } from './base-page';

export class AgentWorkspaceDetailsPage extends BasePage {
  readonly startButton: Locator;
  readonly stopButton: Locator;
  readonly removeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.startButton = this.page.getByRole('button', { name: 'Start Workspace' });
    this.stopButton = this.page.getByRole('button', { name: 'Stop Workspace' });
    this.removeButton = this.page.getByRole('button', { name: 'Remove Workspace' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.page.getByRole('region', { name: 'content' })).toBeVisible({ timeout: TIMEOUTS.SHORT });
  }
}
