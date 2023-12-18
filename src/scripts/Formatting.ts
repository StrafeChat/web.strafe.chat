export class Formatting {

    public static avatar = (id: string, hash: string) => {
        if (hash) {
            const extension = hash.includes('_gif') ? '.gif' : '.png';
            return `${process.env.NEXT_PUBLIC_CDN}/avatars/${id}/${hash.replace(/(_png|_gif)$/, extension)}`
        } else return "";
    }
}