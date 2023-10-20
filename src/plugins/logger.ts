import fp from 'fastify-plugin';
import { ILogObj, Logger } from 'tslog';

declare module 'fastify' {
  interface FastifyInstance {
    logger: Logger<ILogObj>;
  }
}

export default fp(async (fastify, options) => {
  const logger: Logger<ILogObj> = new Logger({
    name: 'shittier.dl',
    prettyLogTemplate: '{{yyyy}}-{{mm}}-{{dd}}T{{hh}}:{{MM}}:{{ss}}Z {{logLevelName}}\t',
    prettyLogTimeZone: 'UTC',
  });

  fastify.addHook('onResponse', (req, res) => {
    fastify.logger.debug(`${req.ip} ${req.method} ${res.statusCode} \t ${req.url}`);
  });

  fastify.decorate('logger', logger);
  logger.debug('Initialized logger plugin');
});
