import fp from "fastify-plugin";
import { z } from "zod";

const configSchema = z.object({
    jwtSecret: z
        .string()
        .min(8, "Too weak JWT secret")
        .max(1024, "That is a very thicc JWT secret"),
    sqliteURL: z.string().optional(),
    password: z.string().min(1, "Missing password"),
});

declare module "fastify" {
    interface FastifyInstance {
        config: z.infer<typeof configSchema>;
    }
}

export default fp(async (fastify, options) => {
    const config = await configSchema.safeParseAsync({
        jwtSecret: Bun.env.JWT_SECRET,
        sqliteURL: Bun.env.SQLITE_URL || "./shittier.db",
        password: Bun.env.PASSWORD,
    });

    if (!config.success) {
        const missing: string[] = [];

        config.error.issues.forEach((v) => {
            missing.push(
                `❌ Environment variable \`${v.path[0]}\`: ${v.message}`
            );
        });

        throw new Error(
            `Missing environment variables!\n ${missing.join("\n")}`
        );
    } else {
        fastify.decorate("config", config.data);
    }
});
