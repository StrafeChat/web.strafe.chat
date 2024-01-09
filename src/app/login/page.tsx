"use client";
import ElectronTitleBar from "@/components/desktop/ElectronTitleBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { validateLogin } from "@/helpers/validator";
import { useUI } from "@/providers/UIProvider";
import { Login } from "@/types";
import cookie from "js-cookie";
import Link from "next/link";
import { FormEvent, useState } from "react";
import "../auth.css";

export default function Page() {

    const { toast } = useToast();
    const { electron } = useUI();
    const [login, setLogin] = useState<Login>({
        email: "",
        password: "",
    });

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const { status, message } = validateLogin({ ...login });

        if (status == 0) return toast({
            title: "Registration Failed",
            description: message,
            className: "bg-destructive"
        })


        const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ ...login }),
        });

        const data = await res.json();

        if (!res.ok) return toast({
            title: "Login Failed",
            description: data.message,
            className: "bg-destructive"
        });
        
        cookie.set("token", data.token);
        window.location.href = "/";
    }

    return (
        <div className="flex flex-col w-full h-full">
         {electron && <ElectronTitleBar />}
          <div className="backdrop align-center">
               <div className="watermark"><Link target="_blank" href={"https://stocksnap.io/author/alteredreality"}> Altered Reality • stocksnap.io</Link></div>
                <Card>
                    <CardHeader>
                        <CardTitle>Login</CardTitle>
                        <CardDescription>Login to your Strafe account to procced!</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="field">
                            <Label htmlFor="email">Email</Label>
                            <Input value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} autoComplete="email" id="email" type="email" />
                        </div>
                        <div className="field">
                            <Label htmlFor="password">Password</Label>
                            <Input value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} autoComplete="current-password" id="password" type="password" />
                        </div>
                        <Button>Login</Button>
                    </form>
                </CardContent>
                <CardFooter>
                    <Link href={"/register"}>Need an account?</Link>
                </CardFooter>
            </Card>
    
          </div>
       </div>
    )
}