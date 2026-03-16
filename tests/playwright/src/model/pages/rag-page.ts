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
import { handleDialogIfPresent } from 'src/utils/app-ready';

import { BaseTablePage } from './base-table-page';
import { RagDetailsPage } from './rag-details-page';

export class RagPage extends BaseTablePage {
  readonly header: Locator;
  readonly heading: Locator;
  readonly noEnvironmentsMessage: Locator;

  constructor(page: Page) {
    super(page, 'rag-environments');
    this.header = this.page.getByRole('region', { name: 'header' });
    this.heading = this.header.getByRole('heading', { name: 'Knowledge Bases' });
    this.noEnvironmentsMessage = this.content.getByText('No RAG environments are currently configured.');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async checkIfRagPageIsEmpty(): Promise<boolean> {
    await this.waitForLoad();
    return (await this.noEnvironmentsMessage.count()) > 0;
  }

  async openEnvironmentDetails(name: string, exact = true): Promise<RagDetailsPage> {
    await this.waitForLoad();
    const row = await this.getRowLocatorByName(name, exact);
    const nameButton = row.getByRole('button').first();
    await expect(nameButton).toBeVisible();
    await nameButton.click();
    return new RagDetailsPage(this.page, name);
  }

  async deleteEnvironmentByName(name: string, exact = true): Promise<void> {
    await this.waitForLoad();
    const row = await this.getRowLocatorByName(name, exact);
    const deleteButton = row.getByLabel('Delete', { exact: true }).first();
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await handleDialogIfPresent(this.page);
  }
}
