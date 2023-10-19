import fp from "fastify-plugin";
import { Logger } from "tslog";

export default fp(async (fastify, options) => {
  const logger = new Logger({
    name: "shittier.dl",
    prettyLogTemplate:
      "{{yyyy}}-{{mm}}-{{dd}}T{{hh}}:{{MM}}:{{ss}}Z {{logLevelName}}\t",
    prettyLogTimeZone: "utc",
  });

  fastify.addHook("onResponse", (req, res) => {
    fastify.logger.debug(
      `${req.ip} ${req.method} ${res.statusCode} \t ${req.url}`
    );
  });

  fastify.decorate("logger", logger);
  logger.debug("Initialized logger plugin");
});
