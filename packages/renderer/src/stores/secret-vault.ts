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

import type { Writable } from 'svelte/store';
import { derived, writable } from 'svelte/store';

import { findMatchInLeaves } from '/@/stores/search-util';
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

// TODO: wire to backend data source
export const secretVaultInfos: Writable<readonly SecretVaultInfo[]> = writable([]);

export const secretVaultSearchPattern = writable('');

export const secretVaultCategoryFilter = writable<'all' | 'api' | 'infra'>('all');

export const filteredSecretVaultInfos = derived(
  [secretVaultInfos, secretVaultSearchPattern, secretVaultCategoryFilter],
  ([$secretVaultInfos, $secretVaultSearchPattern, $secretVaultCategoryFilter]) => {
    let filtered = $secretVaultInfos;

    if ($secretVaultCategoryFilter !== 'all') {
      filtered = filtered.filter(secret => secret.category === $secretVaultCategoryFilter);
    }

    const pattern = $secretVaultSearchPattern.trim();
    if (pattern.length) {
      filtered = filtered.filter(secret => findMatchInLeaves(secret, pattern));
    }

    return filtered;
  },
);
