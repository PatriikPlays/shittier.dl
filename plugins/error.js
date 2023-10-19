import fp from "fastify-plugin";

export class ShittierError extends Error { // this needs to extend Error for fastify to detect it as an error
  constructor(statusCode, statusCodeMessage, message) {
    super();
    this.message = message;
    this.statusCode = statusCode;
    this.statusCodeMessage = statusCodeMessage;
  }
}

const plugin = fp(async (fastify, options) => {
  await fastify.setErrorHandler((error, req, res) => {
    if (error instanceof ShittierError) {
      res.status(error.statusCode).send({
        message: error.message,
        error: error.statusCodeMessage,
        statusCode: error.statusCode,
        ok: false
      });
    } else {
      fastify.logger.error(error);
      res.send(error);
    }
  })
  
  fastify.logger.debug("Error plugin initialized")
})

export { plugin }