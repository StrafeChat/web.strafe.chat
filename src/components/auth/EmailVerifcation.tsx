import { ElectronTitleBar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { validateVerify } from "@/helpers/validator";
import { useClient } from "@/hooks";
import { useUI } from "@/providers/UIProvider";
import { Verify } from "@/types";
import cookie from "js-cookie";
import Link from "next/link";
import Router from "next/router";
import { FormEvent, useState } from "react";

export default function EmailVerifcation() {

    const { toast } = useToast();
    const [verify, setVerify] = useState<Verify>({
        code: "",
    });
    const { client } = useClient();
    const { electron } = useUI();

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const { status, message } = validateVerify({ ...verify });

        if (status == 0) return toast({
            title: "Registration Failed",
            description: message,
            className: "bg-destructive"
        })


        const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/verify`, {
            method: "POST",
            headers: {
                "authorization": `${cookie.get("token")!}`,
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ ...verify }),
        });

        const data = await res.json();

        if (!res.ok) return toast({
            title: "Login Failed",
            description: data.message,
            className: "bg-destructive"
        });

        // @ts-ignore
        client.user = { ...client.user, verified: true };
        Router.reload();
    }

    return (
       <div className="flex flex-col w-full h-full">
         {electron && <ElectronTitleBar />}
           <div className="backdrop align-center">
            <div className="watermark"><Link target="_blank" href={"https://stocksnap.io/author/alteredreality"}> Altered Reality • stocksnap.io</Link></div>
            <Card className="">
                <CardHeader>
                    <CardTitle>Email Verifcation</CardTitle>
                    <CardDescription>Please confirm your email to gain access to Strafe.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="field">
                            <Label htmlFor="email">Verifcation Code</Label>
                            <Input value={verify.code} onChange={(event) => setVerify({ ...verify, code: event.target.value })} autoComplete="number" id="code" type="number" />
                        </div>
                        <br />
                        <Button>Submit</Button>
                    </form>
                </CardContent>
                <CardFooter>
                    <p>Email verification helps us keep your account and our platform secure. </p>
                </CardFooter>
            </Card>
           </div>
          </div>
    )

}