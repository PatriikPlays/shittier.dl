import Fastify from "fastify";
import loggerPlugin from "./plugins/logger";
import multipartPlugin from "./plugins/multipart";
import dbPlugin from "./plugins/db";
import fastifyFormbody from "@fastify/formbody";
import viewPlugin from "@fastify/view";
import jwtPlugin from "./plugins/jwt";
import ejs from "ejs";
import { setErrorHandler } from "./plugins/error";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import fastifyCookie from "@fastify/cookie";
import path from "node:path";
import fs from "node:fs";
import configPlugin from "./plugins/config";
import fastifyStatic from "@fastify/static";

const base = path.join(__dirname, "..");

(async () => {
    const fastify = Fastify({
        logger: false,
    }).withTypeProvider<TypeBoxTypeProvider>();

    const toCheck = path.join(base, "data/files");
    if (!fs.existsSync(toCheck)) {
        fastify.logger.warn("Data directory not found, creating new!");
        fs.mkdirSync(path.join(toCheck, ".."));
        fs.mkdirSync(toCheck);
    }

    fastify.decorate("base", base);

    await fastify.register(loggerPlugin);
    await fastify.register(configPlugin);
    await fastify.register(dbPlugin);
    await fastify.register(jwtPlugin);
    await fastify.register(fastifyFormbody);
    await fastify.register(multipartPlugin);
    await fastify.register(fastifyCookie);
    await fastify.register(viewPlugin, {
        engine: {
            ejs,
        },
    });
    await fastify.register(fastifyStatic, {
        root: path.join(__dirname, "frontend/static"),
    });
    setErrorHandler(fastify);

    fastify.route({
        method: "GET",
        url: "/",
        handler: async (req, res) => {
            res.redirect("/auth");
        },
    });

    fastify.route({
        method: "GET",
        url: "/auth",
        handler: async (req, res) => {
            return res.view("src/frontend/auth.ejs");
        },
    });

    fastify.route({
        method: "GET",
        url: "/gallery",
        onRequest: async (req: any, res: any) => {
            try {
                await req.jwtVerify();
            } catch (err) {
                res.redirect("/auth");
                req.server.logger.debug("User not authenticated.");
            }
        },
        handler: async (req, res) => {
            const testData = [
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
            ];

            return res.view("src/frontend/gallery.ejs", {
                files: testData,
            });
        },
    });

    fastify.register(require("./routes/api/v1/api"), { prefix: "/api/v1" });

    /*
    // dont put auth here
    fastify.get("/l/:linkid", async (req, res) => {
        let linkid = req.params.linkid;

        if (!linkid) return res.send(new ShittierError(400, "Missing linkid"));
        if (linkid.length !== 8)
            return res.send(new ShittierError(400, "Linkid incorrect size"));

        let filename = await new Promise((resolve) => {
            db.resolveLink(linkid)
                .then((data) => {
                    if (data) return resolve(data);
                    return resolve(
                        new ShittierError(400, "Link doens't exist")
                    );
                })
                .catch((e) => {
                    fastify.logger.error(
                        `Failed to resolve link ${linkid}, ${e}`
                    );
                    return resolve(
                        new ShittierError(500, "Internal Server Error")
                    );
                });
        });

        if (filename instanceof ShittierError) return res.send(filename);

        if (sanitizeFilename(filename) != filename) {
            fastify.logger.error(
                `Found improperly sanitized filename in DB (${filename}) on link_id ${linkid}, revoking link ( THIS LIKELY MEANS AN IMPROPERLY SANITIZED FILE EXISTS)`
            );
            await db.revokeLink(linkid);
            return res.send(new ShittierError(500, "Internal Server Error"));
        }

        let p = path.join(__dirname, "data", "files", filename);

        try {
            await fs.promises.stat(p);
        } catch (err) {
            if (err.code === "ENOENT") {
                fastify.logger.error(
                    `Link ${linkid} was pointing to file ${filename}, which doesnt exist, revoking link`
                );
                await db.revokeLink(linkid);
                return res.send(
                    new ShittierError(500, "Internal Server Error")
                );
            } else {
                fastify.logger.error(
                    `Failed to stat file ${filename}, ${err.code}`
                );
                return res.send(
                    new ShittierError(500, "Internal Server Error")
                );
            }
        }

        const stream = fs.createReadStream(p);
        return res.code(200).send(stream); // TODO: check if this deals with mime types
    });



    fastify.post("/authenticate", async (req, res) => {
        /*
    const user = await server.prisma.user.findUnique({
        where: {
          username: req.body.username,
        },
      });

      if (!user || user.password !== req.body.password) {
        return res.status(401).send(loginInvalidCredentials);
      }

      await returnJWT(req, res, user);
    },
    });
    */

    // async function returnJWT(req: FastifyRequest, res: FastifyReply) {
    //     const jwtExpiry = DateTime.now().plus({ days: 365 });
    //     const jwt = req.server.jwt.sign(
    //         {
    //             ok: true,
    //         },
    //         {
    //             expiresIn: "365d",
    //         }
    //     );

    //     res.setCookie("token", jwt, {
    //         domain: "localhost",
    //         path: "/",
    //         secure: true,
    //         httpOnly: true,
    //         sameSite: true,
    //         expires: jwtExpiry.toJSDate(),
    //     }).send({
    //         jwt,
    //         expiry: jwtExpiry.toJSDate(),
    //     });
    // }

    fastify.listen(
        { port: 6900, host: "0.0.0.0", ipv6Only: false },
        (err, address) => {
            if (err) throw err;
            fastify.logger.info(`Server listening on ${address}`);
        }
    );
})();
