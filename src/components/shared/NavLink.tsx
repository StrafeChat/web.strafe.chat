"use client"
import { NavLinkProps } from "@/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function NavLink(props: NavLinkProps) {

    const pathname = usePathname();
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (props.activate?.includes('/' + pathname!.split('/')[1])) setActive(true);
        else switch (true) {
            case props.href.toString().trim() === '/':
                setActive(pathname!.toString().trim() === '/');
                break;
            case pathname!.slice(1).includes(props.href.toString().slice(1)):
                setActive(true);
                break;
            default:
                setActive(false);
                break;
        }
    }, [pathname, props.activate, props.href]);

    return (
        <Link {...props} {...{ "active": `${active}` }} draggable={false}>{props.children}</Link>
    )
}