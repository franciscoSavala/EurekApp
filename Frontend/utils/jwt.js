export function isJwtValid(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        const payload = JSON.parse(atob(padded));
        return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
    } catch {
        return false;
    }
}
