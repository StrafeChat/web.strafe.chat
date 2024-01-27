import { Button } from "@/components/ui/button";
import { formatDiscrim } from "@/helpers/formatter";
import { useClient, useForceUpdate, useModal } from "@/hooks";
import { useState } from "react";

export default function AccountSettings() {

    const { client } = useClient();
    const { openModal } = useModal();
    const forceUpdate = useForceUpdate();

    const [savedData, setSavedData] = useState({
        username: client?.user?.username!,
        email: client?.user?.email!,
        phone_number: client?.user?.phone_number,
        discriminator: client?.user?.discriminator!,
        locale: client?.user?.locale!,
    });

    const [data, setData] = useState(savedData);

    const saveData = () => {
        console.log(data);
        client?.user?.edit(data).catch((err) => console.error(err)).then(() => setSavedData(data));
        forceUpdate();
    }

    return (
        <>
            {JSON.stringify(data) != JSON.stringify(savedData) &&
                <div className="action">
                    <Button className="bg-destructive" onClick={() => setData(savedData)}>Reset</Button>
                    <Button onClick={saveData}>Save</Button>
                </div>
            }
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
                                title: "Edit Username", inputs: [{
                                    defaultValue: data.username, placeholder: "Username", label: "Username", set: (username: string) => {
                                        setData({ ...data, username: username || data.username });
                                    }
                                }]
                            })}>Edit</Button>
                        </div>
                    </div>

                    <div className="item">
                        <div className="first">
                            <label>Discriminator</label>
                            <span>{formatDiscrim(data.discriminator)}</span>
                        </div>
                        <div className="final">
                            <Button onClick={() => openModal("edit-data", {
                                title: "Edit Discriminator", inputs: [{
                                    defaultValue: data.discriminator, placeholder: "Discriminator", label: "Discriminator", set: (discriminator: string) => {
                                        if (isNaN(parseInt(discriminator))) return;
                                        setData({ ...data, discriminator: parseInt(discriminator) || data.discriminator });
                                    }
                                }]
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
                                title: "Edit Email", inputs: [{
                                    defaultValue: data.email, placeholder: "Email", label: "Email", set: (email: string) => {
                                        setData({ ...data, email: email || data.email });
                                    }
                                }]
                            })}>Edit</Button>
                        </div>
                    </div>

                    <div className="item">
                        <div className="first">
                            <label>Password</label>
                            <span>********</span>
                        </div>
                        <div className="final">
                            <Button className="disabled" onClick={() => {
                                return;
                                openModal("edit-data", {
                                    title: "Edit Password", inputs: [{
                                        placeholder: "Current Password", label: "Current Password", set: (password: string) => console.log("Current Password", password)
                                    }, {
                                        placeholder: "New Password", label: "New Password", set: (password: string) => console.log("New Password", password)
                                    }]
                                })
                            }}>Edit</Button>
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
                                    <Button className="bg-destructive disabled">Remove</Button>
                                    <Button className="disabled" onClick={() => openModal("edit-data", {
                                        title: "Edit Phone Number", inputs: [{
                                            defaultValue: data.phone_number, placeholder: "Phone Number", label: "Phone Number", set: (phone_number: string) => {
                                                setData({ ...data, phone_number: phone_number || data.phone_number });
                                            }
                                        }]
                                    })}>Edit</Button>
                                </>
                            ) : <Button className="disabled">Add</Button>}
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="item">
                        <div className="first">
                            <label>2FA</label>
                            <span>{false ? "Enabled" : "Disabled"}</span>
                        </div>
                        <div className="final">
                            <Button className="disabled">Edit</Button>
                        </div>
                    </div>

                    {/* <div className="item">
                        <div className="first">
                            <label>Locale</label>
                            <span>{data.locale.toUpperCase()}</span>
                        </div>
                        <div className="final">
                            <Button className="disabled">Edit</Button>
                        </div>
                    </div> */}

                    <div className="item">
                        <div className="first">
                            <Button className="bg-destructive hover:bg-destructive disabled" onClick={() => {
                                return;
                                openModal("delete-account")
                            }}>Delete Account</Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}