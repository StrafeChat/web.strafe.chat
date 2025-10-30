import { createEffect, createContext, ParentComponent, createSignal, Accessor, Show } from "solid-js"
import { useAuth } from "../auth/AuthProvider";
import { useCache } from "../cache/CacheProvider";
import { RoomWithRecipients } from "../../../types/rooms";

type CallContextType = {
  isCallIncoming: Accessor<boolean>;
}

const CallContext = createContext<CallContextType>();

export const CallProvider: ParentComponent = (props) => {
  const { rooms } = useAuth();
  const { rooms: cachedRooms } = useCache();
  const [isCallIncoming, setIsCallIncoming] = createSignal<boolean>(false);
  const [callingRooms, setCallingRooms] = createSignal<string[]>([]);

  const handledCalls = new Map<string, string[]>();

  createEffect(() => { // static updates propagated through the AuthProvider, usually dispatched on READY
    scanRooms(rooms());
  });

  createEffect(() => { // live updates propagated through the CacheProvider
    scanRooms(cachedRooms());
  });

  const scanRooms = (rooms: RoomWithRecipients[]) => {
    console.log("[CallProvider] Checking for incoming or finished calls.");

    rooms.forEach(r => {
      const ringing = handledCalls.get(r.id) || [];
      if (compareArrays(ringing, r.ringing || [])) return;
      updateCalling(r);
    });

    console.log(rooms);
  }
  const compareArrays = (a: any[], b: any[]): boolean => {
    return a.every((val) => {
      b.includes(val);
    }) && a.length === b.length;
  }
  /**
   * 
   * @param a Array before
   * @param b Array after
   * @returns Added or deleted elements compared to a (compared using `===`)
   */
  const getDiff = <T,>(a: T[], b: T[]): { additions: T[], deletions: T[] } => {
    if (compareArrays(a, b)) return { additions: [], deletions: [] };

    const deletions = [];

    for (let i = 0; i < a.length; i++) {
      const idx = b.findIndex(e => e === a[i]);
      if (idx != -1) {
        b.splice(idx, 1);
        continue;
      }
      deletions.push(a[i]);
    }
    return {
      deletions,
      additions: b
    }
  }
  /**
   * Removes a specified element from an array in place.
   * 
   * @param element Element to remove
   * @param arr Array to remove the element from
   * @returns boolean Wether the element has been found and removed.
   */
  const removeElement = <T,>(element: T, arr: T[]): boolean => {
    const idx = arr.findIndex(e => e === element);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    return true;
  }

  const updateCalling = (room: RoomWithRecipients) => {
    const current = handledCalls.get(room.id) || [];
    const diff = getDiff<string>(current, room.ringing || []);
    diff.deletions.forEach(oldCaller => {
      if (!removeElement(oldCaller, current)) return; // caller wasn't known
      handledCalls.set(room.id, current);
      if (current.length === 0 && callingRooms().includes(room.id)) {
        const callingRs = [...callingRooms()];
        removeElement(room.id, callingRs);
        setCallingRooms(callingRs);
      }

      stopCalling(room, oldCaller);
    });
    diff.additions.forEach(newCaller => {
      if (current.includes(newCaller)) return; 

      current.push(newCaller);
      handledCalls.set(room.id, current);
      if (!callingRooms().includes(room.id)) {
        setCallingRooms([...callingRooms(), room.id])
      }

      console.log("[CallProvider] Incoming call found in room  " + room.id + ": ", room.ringing);

      startCalling(room, newCaller);
    });
  }
  const startCalling = (room: RoomWithRecipients, caller: string) => {
    setIsCallIncoming(true);

    // TODO: present audio and visuals
  }
  const stopCalling = (room: RoomWithRecipients, caller: string) => {
    // TODO: handle this
    if (callingRooms().length === 0) {
      setIsCallIncoming(false);
    }
  }

  return (
    <CallContext.Provider
      value={{
        isCallIncoming
      }}>
      <Show when={isCallIncoming()}>
        <div style={{position: "absolute", top: "5rem", width: "100%", "left": 0, "margin-left": "auto", "z-index": 200}}>
          <h1>You have a call incoming</h1>
        </div>
      </Show>
      
      {props.children}
    </CallContext.Provider>
  )
}