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
  const { setRelationships, user } = useAuth();
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape") set(false);
    });

    document.addEventListener("click", (event: MouseEvent) => {
      if ((event.target as HTMLElement).className.includes("backdrop")) set(false);
    })
  }, [set]);


  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API}/spaces/new`,
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
        <div className="w-[25%] h-fit">
          <form onSubmit={handleSubmit}>
            <div className="card !rounded-b-none">
              <h1 className="title">Create a Space</h1>
              <Input
                placeholder={`${user.username}'s Space`}
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
                Create
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
