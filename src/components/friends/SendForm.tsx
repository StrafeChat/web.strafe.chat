import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormEvent } from "react";
import { Button } from "../ui/button";
import { useClient } from "@/hooks";
import { useToast } from "../ui/use-toast";

export function SendFriendRequestForm({}) {
  const { client } = useClient();
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await client!.user!.sendFriendRequest((event.target as any).username.value, parseInt((event.target as any).discriminator.value));
    if (!result.ok) {
      toast({
        title: "Error",
        description: result.message,
        //duration: 5000,
        variant: "destructive"
      })
    } else {
      (event.target as HTMLFormElement).reset();
    }
  }

  return (
    <div style={{
      width: "100%",
    }}>
      <form onSubmit={handleSubmit}>
        <div style={{
          display: "flex",
          flexDirection: "row",
          gap: "0.2rem",
        }}>
          {/*<Label htmlFor="name">Username</Label>*/}
          <Input name="username" style={{
            flexGrow: 3
          }} type="text" id="name" placeholder="Username"></Input>

          {/*<Label htmlFor="discrim">Discriminator</Label>*/}
          <Input name="discriminator" style={{
            flexGrow: 1
          }} type="text" id="discrim" placeholder="Discriminator"></Input>

          <Button type="submit" variant={"outline"}>Send Friend Request</Button>
        </div>
      </form>
    </div>
  );
}