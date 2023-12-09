"use client";
import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useState,
} from "react";
import { Input } from "../ui/input";
import cookie from "js-cookie";
import { useAuth } from "@/context/AuthContext";

export default function AddFriendModal({
  show,
  set,
}: {
  show: boolean;
  set: Dispatch<SetStateAction<boolean>>;
}) {
  const { setRelationships } = useAuth();

  useEffect(() => {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") set(false);
    });
  }, [set]);

  const [query, setQuery] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const querySplit = query.split("#");
    if (querySplit.length < 2 || querySplit.length > 2)
      return console.log("Something doesn't seem right with your request.");
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API}/users/@me/relationships/${querySplit[0]}-${querySplit[1]}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: cookie.get("token")!,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) return console.log(data);

    setRelationships((prev) => [...prev, data.relationship]);
    set(false);
  };

  return show ? (
    <div className="modal">
      <div className="backdrop">
        <div className="w-fit h-fit">
          <form onSubmit={handleSubmit}>
            <div className="card !rounded-b-none">
              <h1 className="title">Add Friend</h1>
              <Input
                placeholder="username#1234"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                required={true}
              />
            </div>
            <div className="card-2 !rounded-t-none flex justify-end gap-2">
              <button
                type="button"
                className="danger"
                onClick={() => set(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary">
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  ) : (
    <></>
  );
}
