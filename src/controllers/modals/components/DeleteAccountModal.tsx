import { Button } from '@/components/ui/button';
import React, { FormEvent } from 'react';
import Modal from './Modal';

class DeleteAccountModal extends Modal<{}, {}> {
    render() {

        const handleSubmit = (event: FormEvent) => {
            event.preventDefault();
            // TODO: Delete Account
            this.close();
        }

        return (
            <div className='modal-window-wrapper'>
                <div className="modal-window" style={{ width: '500px' }}>
                    <form onSubmit={handleSubmit}>
                        <h1>Delete Account</h1>
                        <p>Are you sure you want to delete your account?</p>
                        <div className="flex gap-2 py-2">
                            <Button className='!bg-destructive' type='button'>Delete Account</Button>
                            <Button className='bg-muted' type='submit'>Cancel</Button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }
}

export default DeleteAccountModal;