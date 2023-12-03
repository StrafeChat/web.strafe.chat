"use client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import "./styles.scss";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import cookie from "js-cookie";
import { useRouter } from "next/navigation";

interface Data {
  email: string;
  password: string;
}

export default function Page() {
  const router = useRouter();
  const form = useForm<Data>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = async (values: Data) => {
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

    if (!res.ok) return console.error(data);

    cookie.set("token", data.token);
    router.push("/");
  };

  return (
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
          <div className="submit">
            <Button>Login</Button>
          </div>
        </form>
      </Form>
    </main>
  );
}
