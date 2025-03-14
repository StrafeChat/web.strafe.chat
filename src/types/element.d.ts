declare global {
  interface Element {
    __unreadMessages?: (unreads: { [roomId: string]: string[] }) => void;
  }
}

export {};