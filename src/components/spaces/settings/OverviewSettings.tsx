import { Button } from "@/components/ui/button";
import { Formatting } from "@/helpers/formatter";
import { useClient, useForceUpdate, useModal } from "@/hooks";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function OverviewSettings() {

    const { client } = useClient();
    const { openModal } = useModal();
    const { t } = useTranslation() ;
    const forceUpdate = useForceUpdate();

    const [savedData, setSavedData] = useState({
        username: client?.user?.username!,
        email: client?.user?.email!,
        phone_number: client?.user?.phoneNumber,
        discriminator: client?.user?.discriminator!,
    });

    const [data, setData] = useState(savedData);

    const saveData = () => {
        client?.user?.edit(data).then(() => setSavedData(data));
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
            <h1 className="title">Overview</h1>
            <div className="card-wrapper">
                {/* <div className="card">

                    <div className="item">
                        <div className="first">
                            <label>{t("modals.settings.my_account.edit_data_01.username.title")}</label>
                            <span>{data.username}</span>
                        </div>
                        <div className="final">
                            <Button onClick={() => openModal("edit-data", {
                                title: "Edit Username", inputs: [{
                                    defaultValue: data.username, placeholder: "Username", label: "Username", set: (username: string) => {
                                        setData({ ...data, username: username || data.username });
                                    }
                                }]
                            })}>{t("modals.settings.my_account.edit_data_01.username.buttons.edit")}</Button>
                        </div>
                    </div>

                    <div className="item">
                        <div className="first">
                            <label>{t("modals.settings.my_account.edit_data_01.discriminator.title")}</label>
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
                            })}>{t("modals.settings.my_account.edit_data_01.discriminator.buttons.edit")}</Button>
                        </div>
                    </div>

                    <div className="item">
                        <div className="first">
                            <label>{t("modals.settings.my_account.edit_data_01.email.title")}</label>
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
                            })}>{t("modals.settings.my_account.edit_data_01.email.buttons.edit")}</Button>
                        </div>
                    </div>

                    <div className="item">
                        <div className="first">
                            <label>{t("modals.settings.my_account.edit_data_01.phone_number.title")}</label>
                            <span>{(() => {
                                return data.phone_number ? <span>{'*'.repeat(data.phone_number.length - 4) + data.phone_number.slice(-4)}</span> : <span className="text-muted-foreground">{t("modals.settings.my_account.edit_data_01.phone_number.placeholder")}</span>
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
                                    })}>{t("modals.settings.my_account.edit_data_01.phone_number.buttons.edit")}</Button>
                                </>
                            ) : <Button className="disabled">Add</Button>}
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="item">
                        <div className="first">
                            <label>2FA</label>
                            <span>{false ? `${t("modals.settings.my_account.edit-data-02.2fa.enabled")}` : `${t("modals.settings.my_account.edit-data-02.2fa.disabled")}`}</span>
                        </div>
                        <div className="final">
                            <Button className="disabled">{t("modals.settings.my_account.edit_data_01.phone_number.buttons.edit")}</Button>
                        </div>
                    </div>

                    <div className="item">
                        <div className="first">
                            <Button className="bg-destructive hover:bg-destructive disabled" onClick={() => {
                                return;
                                openModal("delete-account")
                            }}>{t("modals.settings.my_account.edit-data-02.buttons.delete_account.title")}</Button>
                        </div>
                    </div>
                </div> */}
            </div>
        </>
    )
}