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
  username: string;
  discriminator: string;
  password: string;
  dob: Date;
}

export default function Page() {
  const router = useRouter();
  const form = useForm<Data>({
    defaultValues: {
      email: "",
      username: "",
      discriminator: "9999",
      password: "",
      dob: new Date(),
    },
  });

  const handleSubmit = async (values: Data) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...values,
        discriminator: parseInt(values.discriminator),
        locale: navigator.language,
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
          <h1>Register</h1>
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
            <li className="flex justify-between w-full">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="md:w-[35rem]">
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="Strafe" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discriminator"
                render={({ field }) => (
                  <FormItem className="w-1/10">
                    <FormLabel>Tag</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => {
                          if (event.target.value.length > 4)
                            return event.preventDefault();
                          if (
                            !/[0-9]/g.test(
                              event.target.value[event.target.value.length - 1]
                            ) &&
                            event.target.value != ""
                          )
                            return event.preventDefault();
                          field.onChange(event.target.value);
                        }}
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
            <li>
              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().split("T")[0]
                            : field.value
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </li>
          </ul>
          <div className="submit">
            <Button>Register</Button>
          </div>
        </form>
      </Form>
    </main>
  );
}
