import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyReply, FastifyRequest } from "fastify";

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
        res.send(err);
        req.server.logger.debug("User not authenticated.");
    }
}

export default fp(async (fastify, options) => {
    fastify.register(fastifyJwt, {
        secret: "My JWT secret CHANGE ME NOW",
        cookie: {
            cookieName: "token",
            signed: false,
        },
    });

    fastify.decorate("authenticate", authenticateHook);
});
