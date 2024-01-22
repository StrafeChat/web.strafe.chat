import { Button } from "@/components/ui/button";
import { useClient, useModal } from "@/controllers/hooks";
import { useState } from "react";

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
    });

    const saveData = () => {
        setSavedData(data);
    }

    return (
        <>
            {JSON.stringify(data) != JSON.stringify(savedData) && <Button className="save" onClick={saveData}>Save</Button>}
            <h1 className="title">My Account</h1>
            <div className="account">
                <div className="card">
                    <div className="item">
                        <div className="first">
                            <label>Username</label>
                            <span>{data.username}</span>
                        </div>
                        <div className="final">
                            <Button onClick={() => openModal("edit-data", {
                                title: "Edit Username", defaultValue: client?.user?.username, type: "username", set: (username: string) => {
                                    setData({ ...data, username });
                                }
                            })}>Edit</Button>
                        </div>
                    </div>
                    <div className="item">
                        <div className="first">
                            <label>Email</label>
                            <span>{(() => {
                                const splitArr = data.email?.split('@')!;
                                return `${'*'.repeat(splitArr[0].length)}@${splitArr[1]}`
                            })()}</span>
                        </div>
                        <div className="final">
                            <Button onClick={() => openModal("edit-data", {
                                title: "Edit Email", defaultValue: client?.user?.email, type: "email", set: (email: string) => {
                                    setData({ ...data, email });
                                }
                            })}>Edit</Button>
                        </div>
                    </div>
                    <div className="item">
                        <div className="first">
                            <label>Phone Number</label>
                            <span>{(() => {
                                return data.phone_number ? <span>{'*'.repeat(data.phone_number.length - 4) + data.phone_number.slice(-4)}</span> : <span className="text-muted-foreground">No Phone Number Set</span>
                            })()}</span>
                        </div>
                        <div className="final">
                            {data.phone_number ? (
                                <>
                                    <Button className="bg-destructive">Remove</Button>
                                    <Button onClick={() => openModal("edit-data", {
                                        title: "Edit Phone Number", type: "phone_number", set: (phone_number: string) => {
                                            setData({ ...data, phone_number });
                                        }
                                    })}>Edit</Button>
                                </>
                            ) : <Button>Add</Button>}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}