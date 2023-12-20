"use client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import "./styles.scss";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import cookie from "js-cookie";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ElectronTitleBar from "@/components/ElectronTitleBar";

interface Data {
  email: string;
  password: string;
}

export default function Login() {
  const router = useRouter();
  const form = useForm<Data>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [electron, setElectron] = useState(false);

  const handleSubmit = async (values: Data) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || "An error occurred");
        return;
      }

      cookie.set("token", data.token);
      router.replace("/");
      setTimeout(function () {
      window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      setErrorMessage("An unexpected error occurred");
    }
  };

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf(" electron/") > -1) {
      setElectron(true);
    }
  })

  return (
    <>
   { electron && <ElectronTitleBar /> }
    <main>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <h1>Login</h1>
          <ul>
            <li>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="username@strafe.chat"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </li>
            <li>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="********"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
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
      </Form>
    </main>
    </>
  );
}
