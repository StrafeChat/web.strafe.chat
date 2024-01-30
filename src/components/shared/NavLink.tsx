import { NavLinkProps } from "@/types";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink(props: NavLinkProps) {

    const pathname = usePathname();

    console.log(pathname.slice(1), props.href.toString().slice(1));

    if (props.href.toString().trim() === '/' && pathname.toString().trim() !== '/') return <Link {...props}>{props.children}</Link>

    return (
        <Link {...props} {...{ "active": `${pathname.slice(1).includes(props.href.toString().slice(1))}` }}>{props.children}</Link>
    )
}