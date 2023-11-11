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

export async function authenticateHook<
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

export async function isAuthenticated<
    T extends FastifyRequest,
    U extends FastifyReply
>(req: T, res: U) {
    try {
        await req.jwtVerify();
        return true;
    } catch (err) {
        return false;
    }
}

export default fp(async (fastify, options) => {
    fastify.register(fastifyJwt, {
        secret: fastify.config.jwtSecret,
        cookie: {
            cookieName: "token",
            signed: false,
        },
    });

    fastify.decorate("authenticate", authenticateHook);

    fastify.logger.debug("Initialized JWT plugin");
});
