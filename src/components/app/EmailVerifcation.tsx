import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useClient } from "@/controllers/client/ClientController";
import { validateVerify } from "@/helpers/validator";
import { useUI } from "@/providers/UIProvider";
import { Verify } from "@/types";
import cookie from "js-cookie";
import { FormEvent, useState } from "react";

export default function EmailVerifcation() {

    const { toast } = useToast();
    // const { electron } = useUI();
    const [verify, setVerify] = useState<Verify>({
        code: "",
    });
    const { client, setVerified } = useClient();

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

        client!.user = { ...client!.user!, verified: true };
        setVerified(true);
    }

    return (
        <>
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
        </>
    )

}