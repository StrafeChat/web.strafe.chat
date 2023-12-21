"use client";
import "./styles.scss";
import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import cookie from "js-cookie";

export default function Register() {
  const router = useRouter();

  const date = new Date();

  const [register, setRegister] = useState({
    email: "",
    username: "",
    discriminator: "9999",
    password: "",
    dob: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
  })

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...register,
          discriminator: parseInt(register.discriminator),
          locale: navigator.language,
        }),
      });

      const data = await res.json();

      if (!res.ok) return setErrorMessage(data.message);
      
      cookie.set("token", data.token);
      window.location.href = '/';
    } catch (err) {

    }
  };

  return (
    <main>
      <form onSubmit={handleSubmit}>
        <h1>Register</h1>
        <ul>
          <li>
            <Label htmlFor="email">Email</Label>
            <Input autoComplete="email" id="email" placeholder="username@strafe.chat" value={register.email} onChange={(event) => setRegister({ ...register, email: event.target.value })} />
          </li>
          <li className="flex flex-row gap-4">
            <div className="w-full">
              <Label htmlFor="username">Username</Label>
              <Input autoComplete="username" id="username" placeholder="strafe" value={register.username} onChange={(event) => setRegister({ ...register, username: event.target.value })} />
            </div>
            <div className="w-fit">
              <Label htmlFor="discriminator">Tag</Label>
              <Input id="discriminator" placeholder="0001" maxLength={4} value={register.discriminator} onChange={(event) => setRegister({ ...register, discriminator: event.target.value })} />
            </div>
          </li>
          <li>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="********" value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} />
          </li>
          <li>
            <Label htmlFor="dob">Date of Birth</Label>
            <Input type="date" id="dob" value={register.dob} onChange={(event) => setRegister({ ...register, dob: event.target.value })} />
          </li>
        </ul>
        {errorMessage && (
          <div className="error-message">
            <p><span className="font-bold">ERROR</span> • <span className="error-message-content">{errorMessage}</span></p>
          </div>
        )}
        <div className="submit">
          <Button>Register</Button>
        </div>
      </form>
    </main>
  );
}
