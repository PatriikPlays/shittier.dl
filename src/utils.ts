import { ShittierError } from "./plugins/error";

function generateID(length: number) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";

    for (let i = 0; i < length; i++)
        id += charset.charAt(Math.floor(Math.random() * charset.length));

    return id;
}

async function authHook(req: any, res: any, done: any) {
    if (!req.headers.authorization) return res.send(new ShittierError(403, "Missing authorization"));
    if (req.headers.authorization.length > 8192) return res.send(new ShittierError(403, "Authorization too long"));
    let auth = req.headers.authorization.split(" ");
    if (auth[0] !== "Bearer" || !auth[1]) return res.send(new ShittierError(403, "Invalid token"));
    
    // TODO: maybe add better error handling here
    let ret: any = await new Promise((resolve)=>{
        try {
            req.fastify.jwt.verify(auth[1], (err: Error, decoded: any)=>{
                if (err) resolve(new ShittierError(403, "Invalid token"));
                resolve(true);
            })
        } catch(e) {
            if (e) resolve(new ShittierError(403, "Invalid token"));
        }
    })

    if (ret instanceof ShittierError) return res.send(ret);

    // TODO: figure out why this done() causes handlers to be called twice
    //done(); 
}

export { generateID, authHook }