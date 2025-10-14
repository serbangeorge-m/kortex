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

export class ExtensionsCatalogTabPage extends BasePage {
  readonly catalogExtensionsList: Locator;

  constructor(page: Page) {
    super(page);
    this.catalogExtensionsList = page.getByRole('list', { name: /catalog.?extensions/i });
  }

  getExtensionCard(extensionName: string): Locator {
    return this.page.getByRole('region').filter({ hasText: extensionName });
  }

  getInstallButton(extensionName: string): Locator {
    const extensionCard = this.getExtensionCard(extensionName);
    return extensionCard.getByRole('button', { name: /install/i });
  }
}
