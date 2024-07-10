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
            const space = await client?.spaces.create(this.state.name);
            if (space) this.close();
        }

        const handleJoin = async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API}/users/@me/spaces/${this.state.name}`, {
                method: "PUT",
                headers: {
                    "authorization": `${localStorage.getItem("token")!}`,
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
            <div className='modal-window-wrapper'>
              <div className='modal-backdrop' onClick={() => this.close()}>
                <div className="modal-window" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
                    {(() => {
                        switch (this.state.type) {
                            case 'create':
                                return (
                                    <form onSubmit={handleCreate}>
                                        <div className='flex flex-col gap-2'>
                                            <h1>Create Space</h1>
                                            <div>
                                                <p className='text-xs pt-2 pb-2 uppercase text-gray-300 font-bold'>Space Name</p>
                                                <Input onChange={(e) => this.setState({ ...this.state, name: e.target.value })} type='text' spellCheck={true} placeholder='My Awesome Space' required />
                                            </div>
                                        </div>

                                        <div className="flex gap-2 py-2 w-full">
                                            <Button type='submit' className='w-full bg-primary hover:opacity-55'>Create</Button>
                                        </div>
                                        <p className='hover:underline cursor-pointer' onClick={() => this.setState({ ...this.state, type: "join" })}>Join a space instead?</p>
                                    </form>
                                )
                            case 'join':
                                return (
                                    <form onSubmit={handleJoin}>
                                        <div className='flex flex-col gap-2'>
                                            <h1>Join Space</h1>
                                            <div>
                                                <p className='text-xs pt-2 pb-2 uppercase text-gray-300 font-bold'>Invite Code</p>
                                                <Input onChange={(e) => this.setState({ ...this.state, name: e.target.value })} type='text' placeholder='1a3f41' required />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 py-2 w-full">
                                            <Button type='submit' className='w-full bg-primary hover:opacity-55'>Join</Button>
                                        </div>
                                        <p className='hover:underline cursor-pointer' onClick={() => this.setState({ type: "create" })}>Create a space instead?</p>
                                    </form>
                                )
                            default:
                                break;
                        }
                    })()}
                </div>
              </div>
           </div>
        )
    }

}

export default CreateSpaceModal;