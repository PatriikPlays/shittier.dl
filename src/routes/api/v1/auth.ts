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
    done()
}