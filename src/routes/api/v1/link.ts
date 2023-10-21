import { ShittierError } from "../../../plugins/error";
import sanitizeFilename from "sanitize-filename";
import path from "node:path";
import fs from "node:fs";
import { generateID } from "../../../utils";
import { Type } from "@fastify/type-provider-typebox";
import { authHook } from "../../../utils";

export default function(fastify: any, ops: any, done: any) { // TODO: properly do types here
    fastify.route({
        method: "POST",
        url: "/create/:filename",
        schema: {
            params: Type.Object({
                filename: Type.String({
                    maxLength: 64,
                    minLength: 1,
                })
            })
        },
        preHandler: authHook,
        handler: async (req: any, res: any) => {
            let filename = req.params.filename;
    
            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));
    
            let p = path.join(fastify.base, "data", "files", filename);
    
            try {
                await fs.promises.stat(p);
            } catch (err: any) {
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
                    let id: string;
    
                    while (true) {
                        id = generateID(8);
                        if (!(await fastify.db.resolveLink(id))) break;
                    }
    
                    fastify.db.addLink(id, filename)
                        .then(() => {
                            return resolve({ ok: true, link: id });
                        })
                        .catch((e: any) => {
                            fastify.logger.error(
                                `Failed to create link for file ${filename}, ${e}`
                            );
                            return resolve(
                                new ShittierError(500, "Internal Server Error")
                            );
                        });
                })
            );
        }
    })

    fastify.route({
        method: "POST",
        url: "/revoke/:linkid",
        schema: {
            params: Type.Object({
                linkid: Type.String({
                    maxLength: 8,
                    minLength: 8
                })
            })
        },
        preHandler: authHook,
        handler: async (req: any, res: any) => {
            let linkid = req.params.linkid;
    
            return res.send(
                await new Promise((resolve) => {
                    fastify.db.revokeLink(linkid)
                        .then((success: boolean) => {
                            if (success) return resolve({ ok: true });
                            return resolve(new ShittierError(400, "Link doens't exist"));
                        })
                        .catch((e: any) => {
                            fastify.logger.error(
                                `Failed to revoke link ${linkid}, ${e}`
                            );
                            return resolve(
                                new ShittierError(500, "Internal Server Error")
                            );
                        });
                })
            );
        }
    })

    fastify.route({
        method: "GET",
        url: "/list/:filename",
        schema: {
            params: Type.Object({
                filename: Type.String({
                    maxLength: 64,
                    minLength: 1,
                })
            })
        },
        preHandler: authHook,
        handler: async (req: any, res: any) => {
            let filename = req.params.filename;
    
            if (!filename)
                return res.send(new ShittierError(400, "Missing filename"));
            if (filename.length > 64)
                return res.send(new ShittierError(400, "Filename too long"));
            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));
    
            let p = path.join(fastify.base, "data", "files", filename);
    
            try {
                await fs.promises.stat(p);
            } catch (err: any) {
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
                    fastify.db.listLinks(filename)
                        .then((links: string[]) => {
                            return resolve({ ok: true, data: links });
                        })
                        .catch((e: any) => {
                            fastify.logger.error(
                                `Failed to list links for ${filename}, ${e}`
                            );
                            return resolve(
                                new ShittierError(500, "Internal Server Error")
                            );
                        });
                })
            );
        }
    })

    fastify.route({
        method: "GET",
        url: "/resolve/:linkid",
        schema: {
            params: Type.Object({
                linkid: Type.String({
                    maxLength: 8,
                    minLength: 8
                })
            })
        },
        preHandler: authHook,
        handler: async (req: any, res: any) => {
            let linkid = req.params.linkid;
    
            if (!linkid) return res.send(new ShittierError(400, "Missing linkid"));
            if (linkid.length !== 8)
                return res.send(new ShittierError(400, "Linkid incorrect size"));
    
            return res.send(
                await new Promise((resolve) => {
                    fastify.db.resolveLink(linkid)
                        .then((data: string) => {
                            if (data) return resolve({ ok: true, data: data });
                            return resolve(
                                new ShittierError(400, "Link doens't exist")
                            );
                        })
                        .catch((e: any) => {
                            fastify.logger.error(
                                `Failed to resolve link ${linkid}, ${e}`
                            );
                            return resolve(
                                new ShittierError(500, "Internal Server Error")
                            );
                        });
                })
            );
        }
    })

    done()
}