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

import { openAsBlob } from 'node:fs';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { ChunkProvider, Extension, ExtensionContext } from '@openkaiden/api';
import { extensions, process as apiProcess, rag, Uri } from '@openkaiden/api';
import type { ContainerExtensionAPI } from '@openkaiden/container-extension-api';
import type Dockerode from 'dockerode';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { DoclingExtension } from './docling-extension';
import { generateRandomFolderName } from './util';

vi.mock(import('node:fs'));
vi.mock(import('node:fs/promises'));
vi.mock(import('./util'));

describe('DoclingExtension', () => {
  let extensionContext: ExtensionContext;
  let doclingExtension: DoclingExtension;
  let containerExtensionAPI: ContainerExtensionAPI;
  let dockerodeMock: Dockerode;
  let containerMock: Dockerode.Container;
  let imageMock: Dockerode.Image;

  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();

    console.error = vi.fn();

    // Mock extension context
    extensionContext = {
      subscriptions: [],
      storagePath: '/test/storage',
    } as unknown as ExtensionContext;

    // Mock container
    containerMock = {
      id: 'test-container-id',
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    } as unknown as Dockerode.Container;

    // Mock image
    imageMock = {
      inspect: vi.fn().mockResolvedValue({}),
    } as unknown as Dockerode.Image;

    // Mock dockerode
    dockerodeMock = {
      listContainers: vi.fn().mockResolvedValue([]),
      createContainer: vi.fn().mockResolvedValue(containerMock),
      getContainer: vi.fn().mockReturnValue(containerMock),
      getImage: vi.fn().mockReturnValue(imageMock),
      pull: vi.fn().mockResolvedValue({}),
      modem: {
        followProgress: vi.fn((stream, onFinished) => onFinished(null)),
      },
    } as unknown as Dockerode;

    // Mock container extension API
    containerExtensionAPI = {
      getEndpoints: vi.fn().mockReturnValue([{ dockerode: dockerodeMock }]),
    } as unknown as ContainerExtensionAPI;

    const extensionData = {
      exports: containerExtensionAPI,
    } as unknown as Extension<ContainerExtensionAPI>;

    vi.mocked(extensions.getExtension).mockReturnValue(extensionData);

    doclingExtension = new DoclingExtension(extensionContext);

    // Mock global fetch
    global.fetch = vi.fn();

    // Mock file system operations
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
    vi.mocked(copyFile).mockResolvedValue(undefined);

    // Mock util function
    vi.mocked(generateRandomFolderName).mockReturnValue('randomfolder');
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('activate', () => {
    test('should activate successfully with existing container', async () => {
      vi.useFakeTimers();
      // Mock existing container
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'existing-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
      const spy = vi.spyOn(extensionContext.subscriptions, 'push');

      await doclingExtension.activate();
      await vi.advanceTimersByTimeAsync(1000);

      // Verify chunk provider was registered
      expect(rag.registerChunkProvider).toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    test('should activate successfully by launching new container', async () => {
      // Mock no existing containers
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      // Mock health check
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      await doclingExtension.activate();

      // Verify container was created
      expect(mkdir).toHaveBeenCalledWith(join('/test', 'storage', 'docling-workspace'), { recursive: true });
      expect(dockerodeMock.createContainer).toHaveBeenCalled();
      expect(containerMock.start).toHaveBeenCalled();
      expect(rag.registerChunkProvider).toHaveBeenCalled();
    });

    test('should fail when container extension is not installed', async () => {
      vi.mocked(extensions.getExtension).mockReturnValue(undefined);

      await expect(doclingExtension.activate()).rejects.toThrow(
        'Mandatory extension kaiden.container is not installed',
      );
    });

    test('should fail when container extension exports are missing', async () => {
      const extensionData = { exports: undefined } as unknown as Extension<ContainerExtensionAPI>;
      vi.mocked(extensions.getExtension).mockReturnValue(extensionData);

      await expect(doclingExtension.activate()).rejects.toThrow(
        'Missing exports of API in container extension kaiden.container',
      );
    });

    test('should fail when container launch fails', async () => {
      // Mock no existing containers
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      // Mock container creation failure
      vi.mocked(dockerodeMock.createContainer).mockRejectedValue(new Error('Container creation failed'));

      await expect(doclingExtension.activate()).rejects.toThrow('Container creation failed');
    });

    test('should restart stopped container', async () => {
      vi.useFakeTimers();
      // Mock existing but stopped container
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'stopped-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
            'ai.openkaiden.docling.folder': '/test/workspace',
          },
          Status: 'exited',
          State: 'exited',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await doclingExtension.activate();
      await vi.advanceTimersByTimeAsync(1000);

      // Verify container was started
      expect(containerMock.start).toHaveBeenCalled();
      expect(rag.registerChunkProvider).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('deactivate', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      // Set up container info
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
            'ai.openkaiden.docling.folder': '/test/workspace',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await doclingExtension.activate();
      await vi.advanceTimersByTimeAsync(1000);
      vi.useRealTimers();
    });

    test('should stop container', async () => {
      await doclingExtension.deactivate();

      // Verify container was stopped and removed
      expect(containerMock.stop).toHaveBeenCalled();
    });

    test('should handle errors when stopping container', async () => {
      await doclingExtension.deactivate();

      await vi.waitFor(() => expect(containerMock.stop).toHaveBeenCalled());
    });

    test('should handle errors when cleaning workspace', async () => {
      vi.mocked(rm).mockRejectedValue(new Error('Cleanup failed'));

      await doclingExtension.deactivate();

      expect(console.error).toHaveBeenCalled();
    });

    test('should do nothing if container info is not set', async () => {
      const freshExtension = new DoclingExtension(extensionContext);
      await freshExtension.deactivate();

      expect(apiProcess.exec).not.toHaveBeenCalled();
      expect(rm).not.toHaveBeenCalled();
    });
  });

  describe('convertDocument', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      // Set up container info
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
            'ai.openkaiden.docling.folder': '/test/workspace',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      vi.mocked(openAsBlob).mockResolvedValue(new Blob(['data']));
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await doclingExtension.activate();
      await vi.advanceTimersByTimeAsync(1000);
      vi.useRealTimers();
    });

    test('should convert document successfully', async () => {
      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      const docUri = Uri.file('/path/to/document.pdf');

      // Mock fetch response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          chunks: [{ text: 'first chunk' }, { text: 'second chunk' }, { text: 'third chunk' }],
        }),
      } as unknown as Response);

      const chunks = await doclingExtension.convertDocument(docUri);

      expect(chunks).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalled();
    });

    test('should wait for readiness before making request', async () => {
      vi.useFakeTimers();
      let healthCheckCount = 0;

      // No existing container — force launchContainer path
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      // Health check succeeds on 3rd attempt
      vi.mocked(global.fetch).mockImplementation(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/health')) {
          healthCheckCount++;
          if (healthCheckCount < 3) {
            throw new Error('Not ready yet');
          }
          return { ok: true } as Response;
        }
        // convertDocument request
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            chunks: [{ text: 'chunk1' }],
          }),
        } as unknown as Response;
      });

      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      vi.mocked(openAsBlob).mockResolvedValue(new Blob(['data']));

      // Re-activate via launchContainer path
      const freshExtension = new DoclingExtension(extensionContext);
      await freshExtension.activate();

      const docUri = Uri.file('/path/to/document.pdf');
      let convertResolved = false;
      const convertPromise = freshExtension.convertDocument(docUri).then(result => {
        convertResolved = true;
        return result;
      });

      // convertDocument should be blocked — health check hasn't completed
      await vi.advanceTimersByTimeAsync(500);
      expect(convertResolved).toBe(false);

      // Let health check retries complete (3 x 1000ms)
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      const chunks = await convertPromise;
      expect(convertResolved).toBe(true);
      expect(chunks).toHaveLength(1);

      vi.useRealTimers();
    });

    test('should reject when health check ultimately fails', async () => {
      vi.useFakeTimers();
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // No existing container — force launchContainer path
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      // Health check always fails
      vi.mocked(global.fetch).mockImplementation(async () => {
        throw new Error('Connection refused');
      });

      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);

      const freshExtension = new DoclingExtension(extensionContext);
      await freshExtension.activate();

      const docUri = Uri.file('/path/to/document.pdf');
      const convertPromise = freshExtension.convertDocument(docUri);

      // Attach rejection handler before advancing timers to avoid vitest's
      // unhandled rejection detection firing during timer advancement.
      let convertError: Error | undefined;
      convertPromise.catch((err: unknown) => {
        convertError = err as Error;
      });

      // Advance through all 120 retries in one jump
      await vi.advanceTimersByTimeAsync(120 * 1000);

      expect(convertError).toBeDefined();
      expect(convertError!.message).toBe('Docling service did not become healthy after 120 seconds');

      debugSpy.mockRestore();
      vi.useRealTimers();
    });

    test('should retry health check and recover after previous failure', async () => {
      vi.useFakeTimers();
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      let healthCheckShouldSucceed = false;

      vi.mocked(global.fetch).mockImplementation(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/health')) {
          if (!healthCheckShouldSucceed) {
            throw new Error('Connection refused');
          }
          return { ok: true } as Response;
        }
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            chunks: [{ text: 'recovered chunk' }],
          }),
        } as unknown as Response;
      });

      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      vi.mocked(openAsBlob).mockResolvedValue(new Blob(['data']));

      const freshExtension = new DoclingExtension(extensionContext);
      await freshExtension.activate();

      const docUri = Uri.file('/path/to/document.pdf');

      // First call — health check exhausts all retries
      const firstPromise = freshExtension.convertDocument(docUri);
      let firstError: Error | undefined;
      firstPromise.catch((err: unknown) => {
        firstError = err as Error;
      });

      await vi.advanceTimersByTimeAsync(120 * 1000);
      expect(firstError).toBeDefined();
      expect(firstError!.message).toBe('Docling service did not become healthy after 120 seconds');

      // Service recovers
      healthCheckShouldSucceed = true;

      // Second call — should retry health check and succeed
      const secondPromise = freshExtension.convertDocument(docUri);

      // Advance past the first 1s delay in waitForReady
      await vi.advanceTimersByTimeAsync(1000);

      const chunks = await secondPromise;
      expect(chunks).toHaveLength(1);

      debugSpy.mockRestore();
      vi.useRealTimers();
    });

    test('should throw error if container is not running', async () => {
      const freshExtension = new DoclingExtension(extensionContext);
      const docUri = Uri.file('/path/to/document.pdf');

      await expect(freshExtension.convertDocument(docUri)).rejects.toThrow('Docling container is not running');
    });

    test('should throw error if conversion fails', async () => {
      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      const docUri = Uri.file('/path/to/document.pdf');

      // Mock fetch response with error
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue('Internal server error'),
      } as unknown as Response);

      await expect(doclingExtension.convertDocument(docUri)).rejects.toThrow('Conversion failed');
    });
  });

  describe('discoverExistingContainer', () => {
    test('should discover running container', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'existing-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toMatchObject({
        containerId: 'existing-container-id',
        port: 8080,
      });
    });

    test('should restart stopped container', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'stopped-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
            'ai.openkaiden.docling.folder': '/test/workspace',
          },
          Status: 'exited',
          State: 'exited',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(containerMock.start).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should return undefined when no container found', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toBeUndefined();
    });

    test('should handle errors when listing containers', async () => {
      vi.mocked(dockerodeMock.listContainers).mockRejectedValue(new Error('List failed'));

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle errors when getting endpoints', async () => {
      vi.mocked(containerExtensionAPI.getEndpoints).mockImplementation(() => {
        throw new Error('Failed to get endpoints');
      });

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('launchContainer', () => {
    test('should launch container successfully when image exists', async () => {
      // Mock health check
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      const result = await doclingExtension.launchContainer(containerExtensionAPI);

      expect(imageMock.inspect).toHaveBeenCalled();
      expect(dockerodeMock.createContainer).toHaveBeenCalled();
      expect(containerMock.start).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.containerId).toBe('test-container-id');
    });

    test('should pull image if not available', async () => {
      // Mock image not found
      vi.mocked(imageMock.inspect).mockRejectedValue(new Error('Image not found'));

      // Mock health check
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      const result = await doclingExtension.launchContainer(containerExtensionAPI);

      expect(dockerodeMock.pull).toHaveBeenCalled();
      expect(dockerodeMock.createContainer).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should return immediately without waiting for health check', async () => {
      vi.useFakeTimers();
      let healthCheckCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        healthCheckCount++;
        if (healthCheckCount < 3) {
          throw new Error('Not ready yet');
        }
        return { ok: true } as Response;
      });

      const result = await doclingExtension.launchContainer(containerExtensionAPI);

      expect(result).toBeDefined();
      expect(result.containerId).toBe('test-container-id');
      expect(healthCheckCount).toBe(0);

      // Let the background health check complete
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }
      expect(healthCheckCount).toBe(3);

      vi.useRealTimers();
    });

    test('should throw error when no endpoints available', async () => {
      vi.mocked(containerExtensionAPI.getEndpoints).mockReturnValue([]);

      await expect(doclingExtension.launchContainer(containerExtensionAPI)).rejects.toThrow(
        'No container engine endpoint found',
      );
    });

    test('should throw error when container creation fails', async () => {
      vi.mocked(dockerodeMock.createContainer).mockRejectedValue(new Error('Creation failed'));

      await expect(doclingExtension.launchContainer(containerExtensionAPI)).rejects.toThrow('Creation failed');
    });
  });

  describe('chunk provider', () => {
    test('should register chunk provider with correct implementation', async () => {
      vi.useFakeTimers();
      let registeredProvider: ChunkProvider;
      vi.mocked(rag.registerChunkProvider).mockImplementation(provider => {
        registeredProvider = provider;
        return { dispose: vi.fn() };
      });

      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await doclingExtension.activate();
      await vi.advanceTimersByTimeAsync(1000);

      expect(registeredProvider!).toBeDefined();
      expect(registeredProvider!.name).toBe('docling');
      expect(typeof registeredProvider!.chunk).toBe('function');
      vi.useRealTimers();
    });

    test('should handle chunk provider errors', async () => {
      vi.useFakeTimers();
      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      let registeredProvider: ChunkProvider;
      vi.mocked(rag.registerChunkProvider).mockImplementation(provider => {
        registeredProvider = provider;
        return { dispose: vi.fn() };
      });

      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      vi.mocked(openAsBlob).mockResolvedValue(new Blob(['data']));
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await doclingExtension.activate();
      await vi.advanceTimersByTimeAsync(1000);

      vi.mocked(global.fetch).mockRejectedValue(new Error('Conversion error'));
      vi.useRealTimers();

      const docUri = Uri.file('/path/to/document.pdf');

      await expect(registeredProvider!.chunk(docUri)).rejects.toThrow('Conversion error');

      expect(console.error).toHaveBeenCalledWith('Failed to convert document:', expect.any(Error));
    });
  });
});
