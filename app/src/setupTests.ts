import "@testing-library/jest-dom";

// Provide a working localStorage mock for tests
const store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((key) => delete store[key]);
  },
  key: (index: number) => Object.keys(store)[index] || null,
  get length() {
    return Object.keys(store).length;
  },
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});
