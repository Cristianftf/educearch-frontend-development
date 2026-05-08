const storage = new Map<string, string>()

const localStorageMock = {
  getItem(key: string) {
    return storage.has(key) ? storage.get(key)! : null
  },
  setItem(key: string, value: string) {
    storage.set(key, String(value))
  },
  removeItem(key: string) {
    storage.delete(key)
  },
  clear() {
    storage.clear()
  },
  key(index: number) {
    return Array.from(storage.keys())[index] ?? null
  },
  get length() {
    return storage.size
  },
}

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
})

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  configurable: true,
})

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  })
}
