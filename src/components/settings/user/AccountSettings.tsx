import { Button } from "@/components/ui/button";
import { useClient, useModal } from "@/controllers/hooks";
import { useEffect, useState } from "react";

export default function AccountSettings() {

    const { client } = useClient();
    const { openModal } = useModal();

    const [savedData, setSavedData] = useState({
        username: client?.user?.username!,
        email: client?.user?.email!,
        phone_number: client!.user!.phone_number
    });

    const [data, setData] = useState({
        username: client?.user?.username!,
        email: client?.user?.email!,
        phone_number: client!.user!.phone_number
    })

    return (
        <>
            <h1 className="title">My Account</h1>
            <div className="account">
                <div className="card">
                    <div className="item">
                        <div className="first">
                            <label>Username</label>
                            <span>{savedData.username}</span>
                        </div>
                        <div className="final">
                            <Button>Edit</Button>
                        </div>
                    </div>
                    <div className="item">
                        <div className="first">
                            <label>Email</label>
                            <span>{(() => {
                                const splitArr = savedData.email?.split('@')!;
                                return `${'*'.repeat(splitArr[0].length)}@${splitArr[1]}`
                            })()}</span>
                        </div>
                        <div className="final">
                            <Button onClick={() => openModal("edit-data", {
                                type: "email", set: (email: string) => {
                                    setData({ ...data, email });
                                }
                            })}>Edit</Button>
                        </div>
                    </div>
                    <div className="item">
                        <div className="first">
                            <label>Phone Number</label>
                            <span>{(() => {
                                return savedData.phone_number ? <span>{'*'.repeat(savedData.phone_number.length - 4) + savedData.phone_number.slice(-4)}</span> : <span className="text-muted-foreground">No Phone Number Set</span>
                            })()}</span>
                        </div>
                        <div className="final">
                            {savedData.phone_number ? (
                                <>
                                    <Button className="bg-destructive">Remove</Button>
                                    <Button>Edit</Button>
                                </>
                            ) : <Button>Add</Button>}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}