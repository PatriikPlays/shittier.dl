import { Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { ShittierError } from "../plugins/error";

export default async function (fastify: FastifyInstance) {
    fastify.route({
        method: "POST",
        url: "/login",
        schema: {
            body: Type.Object({
                password: Type.String({
                    minLength: 1,
                    maxLength: 256,
                }),
            }),
        },
        handler: async (req: any, res: any) => {
            if (req.body.password === fastify.config.password) {
                res.send({
                    ok: true,
                    jwt: fastify.jwt.sign({}),
                });
            } else {
                res.send(new ShittierError(403, "Invalid password"));
            }
        },
    });
}
