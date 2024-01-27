export const formatDiscrim = (discrim: string | number) => {
    return discrim.toString().padStart(4, "0");
}