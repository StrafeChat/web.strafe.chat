"use client";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientControllerContext } from '@/controllers/client/ClientController';
import Link from 'next/link';
import React from 'react';
import Modal from './Modal';
import cookie from "js-cookie";
import { ISpace, Space } from '@strafechat/strafe.js';
import { toast } from '@/components/ui/use-toast';

class CreateSpaceModal extends Modal<{ name: string, type: string }, {}> {

    static contextType = ClientControllerContext;
    context!: React.ContextType<typeof ClientControllerContext>;

    state = {
        type: 'create',
        name: '',

    }

    render() {

        const { client } = this.context;

        const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const space = await client?.createSpace(this.state.name);
            if (space) this.close();
        }

        const handleJoin = async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API}/users/@me/spaces/${this.state.name}`, {
                method: "PUT",
                headers: {
                    "authorization": `${cookie.get("token")!}`,
                    "Content-Type": "application/json",
                },
            })
            const data = await res.json();
            if (!res.ok) return toast({
                title: "Joining Space Failed",
                description: data.message,
                className: "bg-destructive"
            });

            let spaceData = data.space;
            spaceData.rooms = data.rooms?? [];
            const space = new Space(spaceData as ISpace);
            client?.spaces.set(space.id, space);

            this.close();
        }

        return (
            <div className='modal-window-wrapper backdrop'>
                <div className="modal-window" style={{ width: '500px' }}>
                    {(() => {
                        switch (this.state.type) {
                            case 'create':
                                return (
                                    <form onSubmit={handleCreate}>
                                        <div className='flex flex-col gap-2'>
                                            <h1>Create Space</h1>
                                            <div>
                                                <Label>Space Name</Label>
                                                <Input onChange={(e) => this.setState({ ...this.state, name: e.target.value })} type='text' spellCheck={true} placeholder='My Awesome Space' />
                                            </div>
                                        </div>

                                        <div className="flex gap-2 py-2 w-full">
                                            <Button type='submit' className='w-full'>Create</Button>
                                            <Button type='button' className='w-full' onClick={() => this.close()}>Cancel</Button>
                                        </div>
                                        <Link href={""} className='link' onClick={() => this.setState({ ...this.state, type: "join" })}>Join a space instead?</Link>
                                    </form>
                                )
                            case 'join':
                                return (
                                    <form onSubmit={handleJoin}>
                                        <div className='flex flex-col gap-2'>
                                            <h1>Join a space</h1>
                                            <div>
                                                <Label>Invite Code</Label>
                                                <Input onChange={(e) => this.setState({ ...this.state, name: e.target.value })} type='text' placeholder='1a3f41' />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 py-2 w-full">
                                            <Button type='submit' className='w-full'>Join</Button>
                                            <Button type='button' className='w-full' onClick={() => this.close()}>Cancel</Button>
                                        </div>
                                        <Link href={""} className='link' onClick={() => this.setState({ type: "create" })}>Create a space instead?</Link>
                                    </form>
                                )
                            default:
                                break;
                        }
                    })()}
                </div>

            </div>
        )
    }

}

export default CreateSpaceModal;