import { createContext, useContext } from 'react'

// { api, coarsePointer, reducedMotion } for every program running on the desktop.
export const Win95Context = createContext(null)
export const useWin95 = () => useContext(Win95Context)
