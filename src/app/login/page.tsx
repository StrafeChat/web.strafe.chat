"use client";
import "./styles.scss";
import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import cookie from "js-cookie";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ElectronTitleBar from "@/components/ElectronTitleBar";

export default function Login() {
  const [register, setRegister] = useState({
    email: "",
    password: ""
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [electron, _setElectron] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(register)
      });

      const data = await res.json();

      if (!res.ok) return setErrorMessage(data.message);

      cookie.set("token", data.token);
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      setErrorMessage("An unexpected error occurred");
    }
  };

  return (
    <>
   { electron && <ElectronTitleBar /> }
    <main>
      <form onSubmit={handleSubmit}>
        <h1>Login</h1>
        <ul>
          <li>
            <Label>Email</Label>
            <Input type="email" autoComplete={"email"} value={register.email} onChange={(event) => setRegister({ ...register, email: event.target.value })} placeholder="username@strafe.chat" />
          </li>
          <li>
            <Label>Password</Label>
            <Input type="password" autoComplete={"current-password"} value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} placeholder="********" />
          </li>
        </ul>
        {errorMessage && (
          <div className="error-message">
            <p><span className="font-bold">ERROR</span> • <span className="error-message-content">{errorMessage}</span></p>
          </div>
        )}
        <div className="submit">
          <Button>Login</Button>
        </div>
        <Link href={"/register"}>Need an account?</Link>
      </form>
    </main>
    </>
  );
}
