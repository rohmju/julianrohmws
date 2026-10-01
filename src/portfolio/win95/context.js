import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

// { api, coarsePointer, reducedMotion } for every program running on the desktop.
export const Win95Context = createContext(null)
export const useWin95 = () => useContext(Win95Context)

// What one program publishes for the others (api.share), e.g. Minesweeper's game for Ask Julian.
// select picks the part the component re-renders for; api.peek(key) reads it all without subscribing.
export function useShared(key, select = (value) => value) {
  const { api } = useWin95()
  const read = useCallback(() => select(api.peek(key)), [api, key, select])
  return useSyncExternalStore(api.subscribe, read)
}

// A tiny store for useShared: share(key, value) replaces a value and tells every subscriber.
export function createSharedStore() {
  const values = new Map()
  const listeners = new Set()
  return {
    share: (key, value) => {
      if (value == null) values.delete(key)
      else values.set(key, value)
      listeners.forEach((listener) => listener())
    },
    peek: (key) => values.get(key),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
