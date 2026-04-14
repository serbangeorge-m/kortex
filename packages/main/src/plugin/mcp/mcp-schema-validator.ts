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

import { type components, createValidator } from '@openkaiden/mcp-registry-types';
import { injectable } from 'inversify';

/**
 * Sub-paths under `server` that track the upstream MCP server.json spec and frequently
 * drift ahead of the bundled OpenAPI schema. Errors rooted at these paths are tolerated
 * so that live registry data doesn't produce noisy validation warnings.
 */
const VOLATILE_SERVER_SUBPATHS = ['/server/packages', '/server/remotes', '/server/icons', '/server/repository'];

/**
 * Determines whether a single AJV validation error can be tolerated for `ServerResponse`
 * payloads from live MCP registries. This replaces per-field payload stripping with a
 * generic, maintenance-free error filter.
 *
 * Tolerated errors:
 * - `additionalProperties` at any path — live schemas add fields faster than the bundled
 *   OpenAPI tracks them (e.g. `_meta` gains `statusChangedAt`, `server` gains new keys).
 * - `pattern` on `/server/name` — third-party registries use names that don't match the
 *   bundled reverse-DNS pattern (e.g. `com.github.mcp` without a `/`).
 * - Any error under volatile sub-paths — `packages`, `remotes`, `icons`, and `repository`
 *   evolve independently and may use shapes the bundled schema hasn't adopted yet.
 */
function isTolerableValidationError(error: { keyword?: string; instancePath?: string }): boolean {
  if (error.keyword === 'additionalProperties') return true;
  if (error.keyword === 'pattern' && error.instancePath === '/server/name') return true;
  const path = error.instancePath;
  if (path && VOLATILE_SERVER_SUBPATHS.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) return true;
  return false;
}

/**
 * Service for validating MCP registry data against OpenAPI schemas.
 * Uses AJV validators created from the mcp-registry-types schemas.
 */
@injectable()
export class MCPSchemaValidator {
  /**
   * Validates JSON data against a specified schema component.
   *
   * @param jsonData - The data to validate
   * @param schemaName - The schema component name (e.g., 'ServerList', 'ServerResponse')
   * @param contextName - Optional context name for error messages (e.g., registry URL)
   * @param suppressWarnings - Optional flag to suppress warnings (default: false)
   * @returns true if the data is valid, false otherwise
   */
  validateSchemaData(
    jsonData: unknown,
    schemaName: keyof components['schemas'],
    contextName?: string,
    suppressWarnings: boolean = false,
  ): boolean {
    const validator = createValidator(schemaName);
    let isValid = validator(jsonData);

    if (!isValid && schemaName === 'ServerResponse' && validator.errors?.every(isTolerableValidationError)) {
      isValid = true;
    }

    if (!isValid && !suppressWarnings) {
      const context = contextName ? ` from '${contextName}'` : '';
      console.warn(
        `[MCPSchemaValidator] Failed to validate data against schema '${schemaName}'${context}. Payload:`,
        jsonData,
        'errors:',
        validator.errors,
      );
    }

    return isValid;
  }
}
