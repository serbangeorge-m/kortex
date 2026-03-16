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

import { expect, test } from '../fixtures/provider-fixtures';
import { TIMEOUTS } from '../model/core/types';
import { waitForNavigationReady } from '../utils/app-ready';

test.describe
  .serial('RAG page - empty state', { tag: '@smoke' }, () => {
    test.beforeEach(async ({ page }) => {
      await waitForNavigationReady(page);
    });

    test('[RAG-01] RAG link is visible in the navigation bar', async ({ workerNavigationBar }) => {
      await expect(workerNavigationBar.ragLink).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
    });

    test('[RAG-02] Navigate to RAG page and verify heading is displayed', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      await expect(ragPage.heading).toBeVisible();
    });

    test('[RAG-03] Empty state message is displayed when no RAG environments exist', async ({
      workerNavigationBar,
    }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      await expect(ragPage.noEnvironmentsMessage).toBeVisible();
      await expect(ragPage.noEnvironmentsMessage).toHaveText('No RAG environments are currently configured.');
    });

    test('[RAG-04] Table is not rendered when no environments exist', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const isEmpty = await ragPage.checkIfRagPageIsEmpty();
      expect(isEmpty).toBeTruthy();
      await expect(ragPage.table).not.toBeVisible();
    });
  });
