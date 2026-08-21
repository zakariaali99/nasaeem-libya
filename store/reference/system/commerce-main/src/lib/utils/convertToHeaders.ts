// Helper function to convert IncomingHttpHeaders to Headers
function convertToHeaders(incomingHeaders: NodeJS.Dict<string | string[]>): Headers {
    const headers = new Headers();
    for (const key in incomingHeaders) {
        const value = incomingHeaders[key];
        if (typeof value === 'string') {
            headers.append(key, value);
        } else if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
        }
    }
    return headers;
}