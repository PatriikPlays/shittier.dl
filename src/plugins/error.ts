import { FastifyInstance } from "fastify";
import Fastify from "fastify";
import httpStatusCodes from "http-status-codes";
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
                error: httpStatusCodes.getStatusText(error.statusCode),
                statusCode: error.statusCode,
                message: error.message,
            });
        } else if (error.code == "FST_ERR_VALIDATION") {
            res.status(400).send({
                ok: false,
                error: httpStatusCodes.getStatusText(400),
                statusCode: 400,
                message: error.message
            })
        } else {
            fastify.logger.error(error);
            res.status(500).send({
                ok: false,
                statusCode: 500,
                error: httpStatusCodes.getStatusText(500),
            });
        }
    });

    fastify.logger.debug("Error plugin initialized");
}
// });
