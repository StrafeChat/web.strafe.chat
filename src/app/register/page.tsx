"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { validateReigster } from "@/helpers/validator";
import { Register } from "@/types";
import cookie from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import "../auth.css";

export default function Register() {

    const date = new Date();

    const { toast } = useToast()
    const [captchaImage, setCaptchaImage] = useState<string | null>(null)

    const [register, setRegister] = useState<Register>({
        email: "",
        global_name: undefined,
        username: "",
        discriminator: (Math.floor(Math.random() * 9999) + 1).toString().padStart(4, '0'),
        password: "",
        dob: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
        captcha: "",
    });

    const fetchCaptcha = useCallback(async () => {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/captcha`, {
            credentials: "include",
        });

        if (!res.ok) return console.error("Failed to load captcha");
        const data: { image: string } = await res.json();
        setCaptchaImage(data.image);
    }, []);

    const fetchCaptchaCalled = useRef(false);

    useEffect(() => {
        if (!fetchCaptchaCalled.current) {
            fetchCaptcha();
            fetchCaptchaCalled.current = true;
        }
    }, [fetchCaptcha]);


    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const parsedDiscrim = parseInt(register.discriminator.toString());

        const { status, message } = validateReigster({ ...register, discriminator: parsedDiscrim });

        if (status == 0) return toast({
            title: "Registration Failed",
            description: message,
            className: "bg-destructive"
        })


        const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ ...register, discriminator: parseInt(register.discriminator.toString()), locale: navigator.language }),
        });

        const data = await res.json();

        if (!res.ok) return toast({
            title: "Registration Failed",
            description: data.message,
            className: "bg-destructive"
        });

        cookie.set("token", data.token);

        window.location.href = "/";
    }

    return !captchaImage ? <div className="align-center">Loading...</div> : (
        <div className="backdrop align-center">
            <div className="watermark"><Link target="_blank" href={"https://stocksnap.io/author/alteredreality"}> Altered Reality • stocksnap.io</Link></div>
            <Card>
                <CardHeader>
                    <CardTitle>Sign Up</CardTitle>
                    <CardDescription>Create an account to get started with Strafe!</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="field">
                            <Label htmlFor="email">Email</Label>
                            <Input value={register.email} onChange={(event) => setRegister({ ...register, email: event.target.value })} autoComplete="email" id="email" type="email" />
                        </div>
                        <div className="field">
                            <Label htmlFor="displayname">Display Name</Label>
                            <Input value={register.global_name} onChange={(event) => setRegister({ ...register, global_name: event.target.value })} autoComplete="displayname" id="displayname" type="text" />
                        </div>
                        <div className="field-wrapper">
                            <div className="field-full">
                                <Label htmlFor="username" aria-required={"true"}>Username</Label>
                                <Input value={register.username} onChange={(event) => setRegister({ ...register, username: event.target.value })} autoComplete="username" id="username" type="text" />
                            </div>
                            <div className="field">
                                <Label htmlFor="discriminator">Tag</Label>
                                <Input value={register.discriminator} onChange={(event) => setRegister({ ...register, discriminator: event.target.value })} autoComplete="off" id="discriminator" type="text" />
                            </div>
                        </div>
                        <div className="field">
                            <Label htmlFor="password">Password</Label>
                            <Input value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} autoComplete="current-password" id="password" type="password" />
                        </div>
                        <div className="field">
                            <Label>Date of Birth</Label>
                            <Input value={register.dob} onChange={(event) => setRegister({ ...register, dob: event.target.value })} type="date" />
                        </div>
                        <div className="field">
                            <Label>Captcha</Label>
                            <Image src={captchaImage} width={250} height={150} className="w-full rounded-md" alt="captcha" />
                            <Input className="mt-2" onChange={(event) => setRegister({ ...register, captcha: event.target.value })} />
                        </div>
                        <Button>Register</Button>
                    </form>
                </CardContent>
                <CardFooter>
                    <Link href={"/login"}>Already have an account?</Link>
                </CardFooter>
            </Card>
        </div>
    )
}