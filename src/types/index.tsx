export interface Register {
    email: string;
    global_name?: string;
    username: string;
    discriminator: string | number;
    password: string;
    confirm_password: string;
    dob: string;
    captcha: string;
}