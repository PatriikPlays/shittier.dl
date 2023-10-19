import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";

async function authenticateHook(req, res) {
  try {
    await req.jwtVerify();
  } catch (err) {
    res.send(err);
    req.server.logger.debug("User not authenticated.");
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
});
