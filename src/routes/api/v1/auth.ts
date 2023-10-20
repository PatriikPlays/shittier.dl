import { ShittierError } from "../../../plugins/error";
import { Type } from "@fastify/type-provider-typebox";

export default function(fastify: any, ops: any, done: any) { // TODO: properly do types here
    fastify.route({
        method: "POST",
        url: "/login",
        schema: {
            body: Type.Object({
                password: Type.String({
                    minLength: 1,
                    maxLength: 256
                })
            })
        },
        handler: async (req: any, res: any)=>{
            if (req.body.password == process.env.PASSWORD) {
                res.send({ ok: true, data: await fastify.jwt.sign({}) });
            } else {
                res.send(new ShittierError(403, "Invalid password"))
            }
        }
    })

    fastify.route({
        method: "POST",
        url: "/verify",
        schema: {
            headers: Type.Object({
                authorization: Type.String({
                    minLength: 1,
                    maxLength: 8192 
                })
            })
        },
        handler: async (req: any, res: any)=>{
            let auth = req.headers.authorization.split(" ");
            if (auth[0] !== "Bearer") return res.send(new ShittierError(403, "Invalid token, Bearer token required"));
            if (!auth[1]) return res.send(new ShittierError(403, "Invalid token"));
            


            res.send(await new Promise((resolve)=>{
                try {
                    fastify.jwt.verify(auth[1], (err: Error, decoded: any)=>{
                        if (err) resolve(new ShittierError(403, "Invalid token"));
                        resolve({ ok: true });
                    })
                } catch(e) {
                    if (e) resolve(new ShittierError(403, "Invalid token"));
                }
            }))
        }
    })
    done()
}