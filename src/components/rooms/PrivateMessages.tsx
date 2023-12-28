import { FaHouseDamage } from "react-icons/fa";
import { FaNoteSticky } from "react-icons/fa6";
import { FiUsers } from "react-icons/fi";
import NavLink from "../nav/NavLink";

export default function PrivateMessages() {
    return (
        <>
            <div className="header">
                <h1>Private Messages</h1>
            </div>
            <div className="tab-list">
                <NavLink href={"/"}>
                    <FaHouseDamage />
                    <span>Home</span>
                </NavLink>
                <NavLink href={"/friends"}>
                    <FiUsers />
                    <span>Friends</span>
                </NavLink>
                <NavLink href={"/notes"}>
                    <FaNoteSticky />
                    <span>Notes</span>
                </NavLink>
            </div>
        </>
    )
}