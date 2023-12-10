"use client";
import { Relationship } from "@/context/AuthContext";
import { Dispatch, SetStateAction } from "react";
import cookie from "js-cookie";

export const copy = (text: string) => {
    navigator.clipboard.writeText(text);
}

export const removeFriend = async (username: string, discriminator: number, setRelationships: Dispatch<SetStateAction<Relationship[]>>) => {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API}/users/@me/relationships/${username}-${discriminator}`,
        {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: cookie.get("token")!,
            },
        }
    );

    const data = await res.json();

    if (!res.ok) return console.log(data);

    setRelationships((prev) =>
        prev.filter(
            (relationship) =>
                relationship.receiver_id !=
                data.relationship.receiver_id &&
                relationship.sender_id !=
                data.relationship.receiver_id
        )
    );
}

export const createPM = async (recipientId: string) => {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API}/users/@me/rooms`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: cookie.get("token")!,
            },
            body: JSON.stringify({
                recipientId,
                type: 0
            })
        }
    );

    const data = await res.json();

    if (!res.ok) return console.log(data);

    console.log(data);
}