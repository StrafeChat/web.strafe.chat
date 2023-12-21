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
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    document.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape") set(false);
    });

    document.addEventListener("click", (event: MouseEvent) => {
      if ((event.target as HTMLElement).className?.includes("backdrop")) set(false);
    });

    return () => {
      document.removeEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Escape") set(false);
      });

      document.removeEventListener("click", (event: MouseEvent) => {
        if ((event.target as HTMLElement).className?.includes("backdrop")) set(false);
      });
    }
  }, [set]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const querySplit = query.split("#");
    if (querySplit.length < 2 || querySplit.length > 2) return setErrorMessage("Something doesn't seem right with your request.");

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

    if (!res.ok) {
      setErrorMessage(data.message || "An error occurred");
      return;
    }

    setRelationships((prev) => [...prev, data.relationship]);
    set(false);

  };

  return show ? (
    <div className="modal">
      <div className="backdrop">
        <div className="w-[25%] h-fit">
          <form onSubmit={handleSubmit}>
            <div className="card !rounded-b-none">
              <h1 className="title">Add Friend</h1>
              <Input
                placeholder="username#1234"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                required={true}
              />
              {errorMessage && (
                <div className="error-message pt-3 bg-[#333333]">
                  <p><span className="text-white font-bold">ERROR • </span><span className="error-message-content text-red-400">{errorMessage}</span></p>
                </div>
              )}
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
