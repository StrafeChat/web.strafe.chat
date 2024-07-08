import { createContext } from "react";

export const VolumeControllerContext = createContext({

});

export function VolumeController({ children }: { children: JSX.Element }) {
  return (
    <VolumeControllerContext.Provider value={{

    }}>
      {children}
    </VolumeControllerContext.Provider>
  );
}