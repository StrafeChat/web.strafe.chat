import { NavLinkProps } from "@/types";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink(props: NavLinkProps) {

    const pathname = usePathname();

    return (
        <Link {...props} {...{ "active": `${pathname == props.href}` }}>{props.children}</Link>
    )
}