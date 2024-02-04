import { useState } from "react";
import { FaHouseChimney, FaNoteSticky, FaUserGroup } from "react-icons/fa6";
import { useTranslation } from 'react-i18next';
import { NavLink } from "../shared";
function Room(){
    const { t } = useTranslation();
    return (
        <>
            <div className="header">
                <h1><b>Private Messages</b></h1>
            </div>
            <div className="tab-list">
                <NavLink href={"/"}>
                    <FaHouseChimney />
                    <span>{t('home_page.header')}</span>
                </NavLink>
                <NavLink href={"/friends"}>
                    <FaUserGroup />
                    <span>{t('friends_page.header')}</span>
                </NavLink>
                <NavLink href={"/notes"}>
                    <FaNoteSticky />
                    <span>{t('notes_page.header')}</span>
                </NavLink>
            </div>

            <div className="seperator" />

            <ul className="private-messages">
                <NavLink href={"/rooms/DJT"}>
                    <li className="private-message">
                        <img src="https://cdn.discordapp.com/attachments/1135670060678123560/1189859177393291284/trumpshutdownraises.png?ex=659fb1b6&is=658d3cb6&hm=bef32dbb441eb1e95258d14d3bc107a5b66976fc10ec6001d96d2a90eecbac32&g" />
                        <span>
                            <h2><b>Donald J. Trump</b></h2>
                            <p className="user-status">Make America Great Again!</p>
                        </span>
                    </li>
                </NavLink>
                <NavLink href={"/rooms/VGR"}>
                    <li className="private-message">
                        <img src="https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fcfany.org%2Fwp-content%2Fuploads%2F2023%2F03%2FVivek-Ramaswamy.jpg&f=1&nofb=1&ipt=55fb8108b716413fb6a8a319ffef83dc20edbb5e7509c832ff292fc1162a0ee8&ipo=images" />
                        <span>
                            <h2><b>Vivek G. Ramaswamy</b></h2>
                            <p className="user-status">Offline</p>
                        </span>
                    </li>
                </NavLink>
            </ul>
        </>
    )
}
export default function PrivateMessageRoomList() {
    let [hide, setHidden] = useState(false)
    let isMobile = window.innerWidth < 768
    window.addEventListener("hide-sidebar", () => setHidden(!hide))
    switch (isMobile) {
      case true:
      if(!hide) return null;
      return (
        <Room />
     )
     default:
        return (
            <Room />
        )
    }
}
