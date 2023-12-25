import { Register } from "@/types";

const fail = (message: string) => {
    return {
        status: 0,
        message
    }
}

export const validateReigster = (register: Partial<Register>): { status: number, message: string | null } => {

    if (!register.email || register.email?.trim() == '') return fail("The email field is required.");

    if (register.global_name) {
        if (!/^[a-zA-Z0-9]+$/.test(register.global_name)) return fail("Display name cannot contain special characters in it.");
        if (register.global_name.length > 32) return fail("The display name cannot exceed the 32 character limit.");
        if (register.global_name == "everyone" || register.global_name == "here") return fail("Your display name cannot be here or everyone.");
    }

    if (!register.username || register.username.trim() == '') return fail("The username field is required.");
    if (!register.discriminator || (register.discriminator as number) < 1) return fail("The tag field is required.");
    if ((register.discriminator as number) > 9999) return fail("Your discriminator cannot be more than 9999.");
    if (!register.password || register.password.trim() == '') return fail("The password field is required.");
    if (register.password.length > 128) return fail("The password cannot be more than 128 characters long.");
    if (register.confirm_password != register.password) return fail("The confirm password field does not match the password field.");
    if (!register.dob) return fail("You need to specify how old you are before you can create an account.");
    
    const date = new Date();
    const chosenDate = new Date(register.dob);

    if (!(chosenDate.getFullYear() <= (date.getFullYear() - 13))) return fail("You need to be 13 years or older to use strafe.");
    if (!register.captcha || register.captcha.trim() == '') return fail("Captcha is required.");

    return { status: 1, message: null };
}