/**
 * OPFS Mock Setup for Jest
 * 
 * This file provides deterministic, resettable mocks for OPFS APIs
 * that are not supported by jsdom environment.
 * 
 * Mocked APIs:
 * - navigator.storage.getDirectory()
 * - FileSystemDirectoryHandle methods
 * - FileSystemFileHandle methods
 * - FileSystemSyncAccessHandle methods
 * - FileSystemWritableFileStream methods
 */

// In-memory file system representation
const mockFileSystem = {
  root: {
    name: '',
    kind: 'directory',
    children: {},
    handles: {},
  },
  currentDirectory: null,
};

// Reset the file system state
function resetFileSystem() {
  mockFileSystem.root = {
    name: '',
    kind: 'directory',
    children: {},
    handles: {},
  };
  mockFileSystem.currentDirectory = null;
}

// FileSystemFileHandle mock
class MockFileSystemFileHandle {
  constructor(name, parent) {
    this.name = name;
    this.parent = parent;
    this.kind = 'file';
    this.content = null;
    this.syncAccessHandle = null;
  }

  async getFile() {
    if (!this.content) {
      this.content = new ArrayBuffer(0);
    }
    return {
      name: this.name,
      size: this.content.byteLength,
      type: 'application/octet-stream',
      lastModified: Date.now(),
      arrayBuffer: async () => this.content,
    };
  }

  async createSyncAccessHandle() {
    if (!this.content) {
      this.content = new ArrayBuffer(0);
    }
    
    this.syncAccessHandle = {
      getSize: () => this.content.byteLength,
      read: (buffer, options) => {
        const { at = 0 } = options || {};
        new Uint8Array(buffer).set(new Uint8Array(this.content), at);
      },
      write: (buffer, options) => {
        const { at = 0 } = options || {};
        const newBuffer = new Uint8Array(buffer.byteLength + at);
        if (at > 0) {
          newBuffer.set(new Uint8Array(this.content).slice(0, at), 0);
        }
        newBuffer.set(new Uint8Array(buffer), at);
        if (at + buffer.byteLength > this.content.byteLength) {
          this.content = newBuffer.buffer;
        } else {
          new Uint8Array(this.content).set(new Uint8Array(buffer), at);
        }
      },
      truncate: (newSize) => {
        if (newSize === 0) {
          this.content = new ArrayBuffer(0);
        } else {
          const newContent = new ArrayBuffer(newSize);
          new Uint8Array(newContent).set(
            new Uint8Array(this.content).slice(0, newSize)
          );
          this.content = newContent;
        }
      },
      flush: () => {},
      close: () => {
        this.syncAccessHandle = null;
      },
    };
    
    return this.syncAccessHandle;
  }

  async createWritable() {
    return {
      write: async (buffer) => {
        if (!this.content) {
          this.content = new ArrayBuffer(0);
        }
        const newBuffer = new Uint8Array(buffer.byteLength + this.content.byteLength);
        new Uint8Array(newBuffer).set(new Uint8Array(this.content), 0);
        new Uint8Array(newBuffer).set(new Uint8Array(buffer), this.content.byteLength);
        this.content = newBuffer.buffer;
      },
      seek: async (position) => {},
      truncate: async (position) => {
        if (position === 0) {
          this.content = new ArrayBuffer(0);
        }
      },
      close: async () => {},
    };
  }
}

// FileSystemDirectoryHandle mock
class MockFileSystemDirectoryHandle {
  constructor(name, parent) {
    this.name = name;
    this.parent = parent;
    this.kind = 'directory';
    this.children = {};
    this.handles = {};
  }

  async getFileHandle(name, options = {}) {
    const { create = false } = options;
    
    if (this.children[name] && this.children[name].kind === 'file') {
      return this.children[name];
    }
    
    if (create) {
      const handle = new MockFileSystemFileHandle(name, this);
      this.children[name] = handle;
      this.handles[name] = handle;
      return handle;
    }
    
    throw new Error(`File not found: ${name}`);
  }

  async getDirectoryHandle(name, options = {}) {
    const { create = false } = options;
    
    if (this.children[name] && this.children[name].kind === 'directory') {
      return this.children[name];
    }
    
    if (create) {
      const handle = new MockFileSystemDirectoryHandle(name, this);
      this.children[name] = handle;
      this.handles[name] = handle;
      return handle;
    }
    
    throw new Error(`Directory not found: ${name}`);
  }

  async resolve(path) {
    const parts = path.split('/').filter(p => p.length > 0);
    let current = this;
    for (const part of parts) {
      if (!current.children[part]) {
        throw new Error(`Path not found: ${path}`);
      }
      current = current.children[part];
    }
    return current;
  }
}

// Mock navigator.storage
const mockNavigatorStorage = {
  getDirectory: async () => {
    if (!mockFileSystem.currentDirectory) {
      mockFileSystem.currentDirectory = mockFileSystem.root;
    }
    return mockFileSystem.currentDirectory;
  },
  estimate: async () => ({
    usage: 0,
    quota: Number.MAX_SAFE_INTEGER,
  }),
  persist: async () => true,
  persistent: true,
};

// Mock navigator
const mockNavigator = {
  storage: mockNavigatorStorage,
  userAgent: 'node.js',
};

// Set up global objects
global.navigator = mockNavigator;
global.FileSystemFileHandle = MockFileSystemFileHandle;
global.FileSystemDirectoryHandle = MockFileSystemDirectoryHandle;

// Reset before each test
beforeEach(() => {
  resetFileSystem();
});

// Clean up after all tests
afterAll(() => {
  resetFileSystem();
});

module.exports = {
  resetFileSystem,
  MockFileSystemFileHandle,
  MockFileSystemDirectoryHandle,
};
