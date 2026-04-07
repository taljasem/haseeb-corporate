import { createContext, useContext } from "react";

export const NavContext = createContext({
  setActiveScreen: () => {},
  openTask: () => {},
});

export const useNav = () => useContext(NavContext);
