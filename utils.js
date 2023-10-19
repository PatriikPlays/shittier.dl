function generateID(length) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";

    for (let i = 0; i < length; i++)
        id += charset.charAt(Math.floor(Math.random() * charset.length));

    return id;
}

export { generateID }