export function normalizeGuess(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export function isSameTitle(guess: string, titleOrAlias: string): boolean {
    return normalizeGuess(guess) === normalizeGuess(titleOrAlias);
}
