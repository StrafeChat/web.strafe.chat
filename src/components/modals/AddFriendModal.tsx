import { Dispatch, SetStateAction, useEffect } from "react";
import { Input } from "../ui/input";

export default function AddFriendModal({
  show,
  set,
}: {
  show: boolean;
  set: Dispatch<SetStateAction<boolean>>;
}) {
  useEffect(() => {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") set(false);
    });
  }, [set]);

  return show ? (
    <div className="modal">
      <div className="backdrop">
        <div className="w-fit h-fit">
          <form>
            <div className="card !rounded-b-none">
              <h1 className="title">Add Friend</h1>
              <Input placeholder="username#1234" />
            </div>
            <div className="card-2 !rounded-t-none flex justify-end gap-2">
              <button className="danger" onClick={() => set(false)}>
                Cancel
              </button>
              <button className="primary">Send</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  ) : (
    <></>
  );
}
