import { ParentProps, createContext, createSignal, useContext } from "solid-js";

type MobileNavContextType = {
  currentView: () => "spaces" | "content";
  setCurrentView: (view: "spaces" | "content") => void;
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: (e: TouchEvent) => void;
  handleTouchEnd: () => void;
};

const MobileNavContext = createContext<MobileNavContextType>();

export const MobileNavProvider = (props: ParentProps) => {
  const [currentView, setCurrentView] = createSignal<"spaces" | "content">(
    "content",
  );
  const [touchStart, setTouchStart] = createSignal(0);
  const [touchEnd, setTouchEnd] = createSignal(0);

  const minSwipeDistance = 50;

  const handleTouchStart = (e: TouchEvent) => {
    setTouchEnd(0);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart() || !touchEnd()) return;

    const distance = touchStart() - touchEnd();
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentView() === "spaces") {
      setCurrentView("content");
    }

    if (isRightSwipe && currentView() === "content") {
      setCurrentView("spaces");
    }
  };

  const value = {
    currentView,
    setCurrentView,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };

  return (
    <MobileNavContext.Provider value={value}>
      {props.children}
    </MobileNavContext.Provider>
  );
};

export const useMobileNav = () => {
  const context = useContext(MobileNavContext);
  if (!context) {
    throw new Error("useMobileNav must be used within a MobileNavProvider");
  }
  return context;
};
