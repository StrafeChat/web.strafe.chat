import { JSX } from 'solid-js';

export type ContextMenuContextType = {
  isOpen: boolean;
  x: number;
  y: number;
  content: JSX.Element | null;
  openContextMenu: (
    event: MouseEvent, 
    menuContent: JSX.Element
  ) => void;
  closeContextMenu: () => void;
};

export type ModalContextType = {
  isOpen: boolean;
  content: JSX.Element | null;
  openModal: (modalContent: JSX.Element) => void;
  closeModal: () => void;
};
