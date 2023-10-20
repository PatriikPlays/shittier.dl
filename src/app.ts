import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import loggerPlugin from "./plugins/logger";
import multipartPlugin from "./plugins/multipart";
import { ShittierError, setErrorHandler } from "./plugins/error";
import { Type, TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import fastifyCookie from "@fastify/cookie";
import path from "node:path";
import fs from "node:fs";
import pump from "pump";
import sanitizeFilename from "sanitize-filename";
import { generateID } from "./utils";
import { DateTime } from "luxon";
// import DB from "./db";

const base = path.join(__dirname, "..");

(async () => {
    const fastify = Fastify({
        logger: false,
    }).withTypeProvider<TypeBoxTypeProvider>();

    await fastify.register(loggerPlugin);
    await fastify.register(multipartPlugin);
    await fastify.register(fastifyCookie);
    setErrorHandler(fastify);

    const toCheck = path.join(base, "data/files");
    if (!fs.existsSync(toCheck)) {
        fastify.logger.warn("Data directory not found, creating new!");
        fs.mkdirSync(path.join(toCheck, ".."));
        fs.mkdirSync(toCheck);
    }

    // const db = new DB();

    // TODO: Add auth
    fastify.route({
        method: "GET",
        url: "/f/:filename",
        schema: {
            params: Type.Object({
                filename: Type.String({
                    maxLength: 64,
                    minLength: 1,
                }),
            }),
        },
        handler: async (req, res) => {
            const { filename } = req.params;

            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));

            const p = path.join(base, "data", "files", filename);

            if (!fs.existsSync(p)) {
                return res.send(new ShittierError(404, "Not Found"));
            }

            const stream = fs.createReadStream(p);
            return res.code(200).send(stream); // TODO: Set application-type/png and MIME
        },
    });

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

    // TODO: Add auth
    fastify.post("/file/upload", async (req, res) => {
        const data = await req.file();
        const file = data.file;
        const filename = data.filename;

        if (filename.length > 64)
            return res.send(new ShittierError(400, "Filename too long"));
        if (sanitizeFilename(filename) != filename)
            return res.send(new ShittierError(400, "Invalid filename"));

        let p = path.join(__dirname, "data", "files", filename);

        try {
            await fs.promises.stat(p);
            return res.send(new ShittierError(400, "File already exists"));
        } catch (err) {
            if (err.code !== "ENOENT") {
                fastify.logger.error(
                    `Failed to stat file ${filename}, ${err.code}`
                );
                return res.send(
                    new ShittierError(500, "Internal Server Error")
                );
            }
        }

        let writeStream = fs.createWriteStream(p);

        res.send(
            await new Promise((resolve) => {
                pump(file, writeStream)
                    .on("finish", () => {
                        resolve({ ok: true });
                    })
                    .on("error", (e) => {
                        fastify.logger.error(`Failed to write to ${p}, ${e}`);
                        resolve(
                            new ShittierError(500, "Internal Server Error")
                        );
                    });
            })
        );
    });

    // TODO: Add auth
    // uses post for cc compat
    fastify.post("/file/delete/:filename", async (req, res) => {
        let filename = req.params.filename;

        if (!filename)
            return res.send(new ShittierError(400, "Missing filename"));
        if (filename.length > 64)
            return res.send(new ShittierError(400, "Filename too long"));
        if (sanitizeFilename(filename) != filename)
            return res.send(new ShittierError(400, "Invalid filename"));

        let p = path.join(__dirname, "data", "files", filename);

        try {
            await fs.promises.stat(p);
        } catch (err) {
            if (err.code === "ENOENT") {
                return res.send(new ShittierError(400, "File doesn't exist"));
            } else {
                fastify.logger.error(
                    `Failed to stat file ${filename}, ${err.code}`
                );
                return res.send(
                    new ShittierError(500, "Internal Server Error")
                );
            }
        }

        try {
            await fs.promises.unlink(p);
        } catch (err) {
            fastify.logger.error(`Failed to unlink file ${filename}, ${err}`);
            return res.send(new ShittierError(500, "Internal Server Error"));
        }

        return res.send(
            await new Promise(async (resolve) => {
                db.deleteLinksPointingToFile(filename)
                    .then(() => {
                        resolve({ ok: true });
                    })
                    .catch((err) => {
                        fastify.logger.error(
                            `Failed to delete links pointing to file ${filename}, ${err}`
                        );
                        resolve(
                            new ShittierError(500, "Internal Server Error")
                        );
                    });
            })
        );
    });

    // TODO: Add auth
    // uses post for cc compat
    fastify.post("/file/rename/:filename", async (req, res) => {
        let filename = req.params.filename;
        let newName = req.query.newName;

        if (!filename)
            return res.send(new ShittierError(400, "Missing filename"));
        if (!newName)
            return res.send(new ShittierError(400, "Missing newName"));
        if (filename.length > 64)
            return res.send(new ShittierError(400, "Filename too long"));
        if (newName.length > 64)
            return res.send(new ShittierError(400, "newName too long"));
        if (sanitizeFilename(filename) != filename)
            return res.send(new ShittierError(400, "Invalid filename"));
        if (sanitizeFilename(newName) != newName)
            return res.send(
                new ShittierError(400, "Bad Request", "Invalid newName")
            );

        let p = path.join(__dirname, "data", "files", filename);

        try {
            await fs.promises.stat(p);
        } catch (err) {
            if (err.code === "ENOENT") {
                return res.send(new ShittierError(400, "File doesn't exist"));
            } else {
                fastify.logger.error(
                    `Failed to stat file ${filename}, ${err.code}`
                );
                return res.send(
                    new ShittierError(500, "Internal Server Error")
                );
            }
        }

        // im sorry:
        let links;
        await db
            .listLinks(filename)
            .then(async (l) => {
                links = l;
            })
            .catch((e) => {
                fastify.logger.error(
                    `Failed to list links to file ${filename}, ${e}`
                );
                links = new ShittierError(500, "Internal Server Error");
            });

        if (links instanceof ShittierError) return res.send(links);

        for (let i = 0; i < links.length; i++) {
            let link = links[i];
            let err;

            await db.setLink(link, newName).catch((err) => {
                fastify.logger.error(
                    `Failed to set link ${link} from ${filename} to ${newName}, ${err}`
                );
                err = new ShittierError(500, "Internal Server Error");
            });

            if (err) {
                return res.send(err);
            }
        }

        await fs.promises
            .rename(p, path.join(__dirname, "data", "files", newName))
            .then(() => {
                return res.send({ ok: true });
            })
            .catch((e) => {
                fastify.logger.error(
                    `Failed to rename file ${filename} to ${newName}, ${e}`
                );
                return res.send(
                    new ShittierError(500, "Internal Server Error")
                );
            });
    });

    // TODO: Add auth
    fastify.get("/file/list", async (req, res) => {
        let p = path.join(__dirname, "data", "files");

        return res.send(
            await new Promise((resolve) => {
                fs.readdir(p, (err, data) => {
                    if (err) {
                        fastify.logger.error(`Failed to list dir ${p}, ${err}`);
                        return resolve(
                            new ShittierError(500, "Internal Server Error")
                        );
                    }

                    return resolve({ ok: true, data: data });
                });
            })
        );
    });

    // TODO: Add auth
    fastify.post("/link/create/:filename", async (req, res) => {
        let filename = req.params.filename;

        if (!filename)
            return res.send(new ShittierError(400, "Missing filename"));
        if (filename.length > 64)
            return res.send(new ShittierError(400, "Filename too long"));
        if (sanitizeFilename(filename) != filename)
            return res.send(new ShittierError(400, "Invalid filename"));

        let p = path.join(__dirname, "data", "files", filename);

        try {
            await fs.promises.stat(p);
        } catch (err) {
            if (err.code === "ENOENT") {
                return res.send(new ShittierError(400, "File doesn't exist"));
            } else {
                fastify.logger.error(
                    `Failed to stat file ${filename}, ${err.code}`
                );
                return res.send(
                    new ShittierError(500, "Internal Server Error")
                );
            }
        }

        return res.send(
            await new Promise(async (resolve) => {
                let id;

                while (true) {
                    id = generateID(8);
                    if (!(await db.resolveLink(id))) break;
                }

                db.addLink(id, filename)
                    .then(() => {
                        return resolve({ ok: true, link: id });
                    })
                    .catch((e) => {
                        fastify.logger.error(
                            `Failed to create link for file ${filename}, ${e}`
                        );
                        return resolve(
                            new ShittierError(500, "Internal Server Error")
                        );
                    });
            })
        );
    });

    // TODO: Add auth
    fastify.post("/link/revoke/:linkid", async (req, res) => {
        let linkid = req.params.linkid;

        if (!linkid) return res.send(new ShittierError(400, "Missing linkid"));
        if (linkid.length !== 8)
            return res.send(
                new ShittierError(400, "Link ID has incorrect size")
            );

        return res.send(
            await new Promise((resolve) => {
                db.revokeLink(linkid)
                    .then((success) => {
                        if (success) return resolve({ ok: true });
                        return resolve(
                            new ShittierError(400, "Link doens't exist")
                        );
                    })
                    .catch((e) => {
                        fastify.logger.error(
                            `Failed to revoke link ${linkid}, ${e}`
                        );
                        return resolve(
                            new ShittierError(500, "Internal Server Error")
                        );
                    });
            })
        );
    });

    // TODO: Add auth
    fastify.get("/link/list/:filename", async (req, res) => {
        let filename = req.params.filename;

        if (!filename)
            return res.send(new ShittierError(400, "Missing filename"));
        if (filename.length > 64)
            return res.send(new ShittierError(400, "Filename too long"));
        if (sanitizeFilename(filename) != filename)
            return res.send(new ShittierError(400, "Invalid filename"));

        let p = path.join(__dirname, "data", "files", filename);

        try {
            await fs.promises.stat(p);
        } catch (err) {
            if (err.code === "ENOENT") {
                return res.send(new ShittierError(400, "File doesn't exist"));
            } else {
                fastify.logger.error(
                    `Failed to stat file ${filename}, ${err.code}`
                );
                return res.send(
                    new ShittierError(500, "Internal Server Error")
                );
            }
        }

        return res.send(
            await new Promise((resolve) => {
                db.listLinks(filename)
                    .then((links) => {
                        return resolve({ ok: true, data: links });
                    })
                    .catch((e) => {
                        fastify.logger.error(
                            `Failed to list links for ${filename}, ${e}`
                        );
                        return resolve(
                            new ShittierError(500, "Internal Server Error")
                        );
                    });
            })
        );
    });

    // TODO: Add auth
    fastify.get("/link/resolve/:linkid", async (req, res) => {
        let linkid = req.params.linkid;

        if (!linkid) return res.send(new ShittierError(400, "Missing linkid"));
        if (linkid.length !== 8)
            return res.send(new ShittierError(400, "Linkid incorrect size"));

        return res.send(
            await new Promise((resolve) => {
                db.resolveLink(linkid)
                    .then((data) => {
                        if (data) return resolve({ ok: true, data: data });
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
            })
        );
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

    fastify.listen({ port: 6900 }, (err, address) => {
        if (err) throw err;
        fastify.logger.info(`Server listening on ${address}`);
    });
})();
