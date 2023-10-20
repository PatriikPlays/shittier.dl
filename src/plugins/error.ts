import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export class ShittierError extends Error {
    // this needs to extend Error for fastify to detect it as an error according to patriik
    statusCode: number;
    message: string;

    constructor(statusCode: number, message: string) {
        super();
        this.message = message;
        this.statusCode = statusCode;
    }
}

// const plugin = fp(async (fastify, options) => {
export function setErrorHandler(fastify: FastifyInstance) {
    fastify.setErrorHandler((error, req, res) => {
        if (error instanceof ShittierError) {
            res.status(error.statusCode).send({
                ok: false,
                message: error.message,
            });
        } else {
            fastify.logger.error(error);
            res.send(error);
        }
    });

    fastify.logger.debug("Error plugin initialized");
}
// });
