import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyReply, FastifyRequest } from "fastify";
import { ShittierError } from "./error";

declare module "fastify" {
    interface FastifyInstance {
        authenticate: (
            request: FastifyRequest,
            reply: FastifyReply
        ) => Promise<void>;
    }
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: { id: string };
        user: {
            id: string;
        };
    }
}

async function authenticateHook<
    T extends FastifyRequest,
    U extends FastifyReply
>(req: T, res: U) {
    try {
        await req.jwtVerify();
    } catch (err) {
        res.send(new ShittierError(403, "Not authenticated"));
        req.server.logger.debug("User not authenticated.");
    }
}

export default fp(async (fastify, options) => {
    if (!process.env.JWT_SECRET)
        throw new Error("Missing JWT_SECRET env variable"); // regen JWT_SECRET to invalidate all JWTs (JWTs will stay valid when password gets changed)

    fastify.register(fastifyJwt, {
        secret: process.env.JWT_SECRET,
        cookie: {
            cookieName: "token",
            signed: false,
        },
    });

    fastify.decorate("authenticate", authenticateHook);

    fastify.logger.debug("Initialized JWT plugin");
});
