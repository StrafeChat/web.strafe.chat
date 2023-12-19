"use client";
import {
    Dispatch,
    FormEvent,
    SetStateAction,
    useEffect,
    useState,
} from "react";
import { Input } from "../ui/input";
import { useAuth } from "@/context/AuthContext";
import { updatePresence } from "@/scripts/Modal";

export default function ChangeStatusModal({
    show,
    set,
}: {
    show: boolean;
    set: Dispatch<SetStateAction<boolean>>;
}) {

    const { user, setStatusText, statusText, ws } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") set(false);
        });
        document.addEventListener("click", (event: MouseEvent) => {
            if(event.target) {
                if(event.target as HTMLElement) {
                    if ((event.target as HTMLElement).className.includes("backdrop")) set(false);
                }
            }
          })
    }, [set]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        try {
        updatePresence(ws?.current, { status: user.presence.status, status_text: statusText });
        } catch (error) {
            console.error("An unexpected error occurred:", error);
            setErrorMessage("An unexpected error occurred");
            return;
        }
        set(false);
    };

    return (
        <div className="modal">
            <div className="backdrop">
                <div className="w-[25%] h-fit">
                    <form onSubmit={handleSubmit}>
                        <div className="card !rounded-b-none">
                            <h1 className="title">Set Status</h1>
                            <Input
                                placeholder={user.presence ? user.presence.status_text : ""}
                                value={statusText}
                                onChange={(event) => setStatusText(event.target.value)}
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
                                Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
