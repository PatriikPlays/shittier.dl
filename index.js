import Fastify from 'fastify'
import loggerPlugin from "./plugins/logger.js"
import multipartPlugin from "./plugins/multipart.js";
import { ShittierError, plugin as errorPlugin } from './plugins/error.js';
import fastifyCookie from '@fastify/cookie';
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import pump from "pump";
import sqlite3 from 'sqlite3';
import sanitizeFilename from "sanitize-filename";
import { generateID } from './utils.js';
import { DateTime } from "luxon";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
    logger: false
})

await fastify.register(loggerPlugin);
await fastify.register(errorPlugin);
await fastify.register(multipartPlugin);
await fastify.register(fastifyCookie)

class DB {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, "data", "db.sqlite"));

        this.db.serialize(() => {
            this.db.run("CREATE TABLE IF NOT EXISTS links (link_id TEXT, filename TEXT)")
        })
    }

    resolveLink(link) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT filename FROM links WHERE link_id = ?", [link], (err, row) => {
                if (err) {
                    return reject(err);
                }
                if (row) {
                    resolve(row.filename);
                } else {
                    resolve(null);
                }
            })
        })
    }

    addLink(link, filename) {
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO links (link_id, filename) VALUES (?, ?)", [link, filename], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    setLink(link, filename) {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE links SET filename = ? WHERE link_id = ?", [filename, link], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    
    revokeLink(link) {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM links WHERE link_id = ?", [link], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    listLinks(filename) {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT link_id FROM links WHERE filename = ?", [filename], function(err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.link_id));
                }
            });
        })
    }

    deleteLinksPointingToFile(filename) {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM links WHERE filename = ?", [filename], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
}

if (!fs.existsSync("./data/files")) {
    fs.mkdirSync("./data/files");
}

const db = new DB();

// TODO: Add auth
fastify.get("/f/:filename", async (req, res) => {
    var filename = req.params.filename;
    
    if (!filename) return res.send(new ShittierError(400, "Bad Request", "Missing filename"));
    if (filename.length > 64) return res.send(new ShittierError(400, "Bad Request", "Filename too long"));
    if (sanitizeFilename(filename) != filename) return res.send(new ShittierError(400, "Bad Request", "Invalid filename"));

    var p = path.join(__dirname, "data", "files", filename);

    try {
        await fs.promises.stat(p);
    } catch (err) {
        if (err.code === "ENOENT") {
            return res.send(new ShittierError(404, "Not Found"));
        } else {
            fastify.logger.error(`Failed to stat file ${filename}, ${err.code}`);
            return res.send(new ShittierError(500, "Internal Server Error"));
        }
    }

    const stream = fs.createReadStream(p);
    return res.code(200).send(stream); // TODO: check if this deals with mime types
})

// dont put auth here
fastify.get("/l/:linkid", async (req, res) => {
    var linkid = req.params.linkid;
    
    if (!linkid) return res.send(new ShittierError(400, "Bad Request", "Missing linkid"));
    if (linkid.length !== 8) return res.send(new ShittierError(400, "Bad Request", "Linkid incorrect size"));

    let filename = await new Promise((resolve) => {
        db.resolveLink(linkid).then((data)=>{
            if (data) return resolve(data);
            return resolve(new ShittierError(400, "Bad Request", "Link doens't exist"))
        }).catch((e)=>{
            fastify.logger.error(`Failed to resolve link ${linkid}, ${e}`);
            return resolve(new ShittierError(500, "Internal Server Error"));
        })
    })

    if (filename instanceof ShittierError)
        return res.send(filename);

    if (sanitizeFilename(filename) != filename) {
        fastify.logger.error(`Found improperly sanitized filename in DB (${filename}) on link_id ${linkid}, revoking link ( THIS LIKELY MEANS AN IMPROPERLY SANITIZED FILE EXISTS)`);
        await db.revokeLink(linkid);
        return res.send(new ShittierError(500, "Internal Server Error"));
    }

    var p = path.join(__dirname, "data", "files", filename);

    try {
        await fs.promises.stat(p);
    } catch (err) {
        if (err.code === "ENOENT") {
            fastify.logger.error(`Link ${linkid} was pointing to file ${filename}, which doesnt exist, revoking link`);
            await db.revokeLink(linkid);
            return res.send(new ShittierError(500, "Internal Server Error"));
        } else {
            fastify.logger.error(`Failed to stat file ${filename}, ${err.code}`);
            return res.send(new ShittierError(500, "Internal Server Error"));
        }
    }

    const stream = fs.createReadStream(p);
    return res.code(200).send(stream); // TODO: check if this deals with mime types
})

// TODO: Add auth
fastify.post("/file/upload", async (req, res) => {
    const data = await req.file()
    const file = data.file;
    const filename = data.filename;

    if (filename.length > 64) return res.send(new ShittierError(400, "Bad Request", "Filename too long"));
    if (sanitizeFilename(filename) != filename) return res.send(new ShittierError(400, "Bad Request", "Invalid filename"));

    var p = path.join(__dirname, "data", "files", filename);

    try {
        await fs.promises.stat(p);
        return res.send(new ShittierError(400, "Bad Request", "File already exists"));
    } catch (err) {
        if (err.code !== "ENOENT") {
            fastify.logger.error(`Failed to stat file ${filename}, ${err.code}`);
            return res.send(new ShittierError(500, "Internal Server Error"));
        }
    }

    var writeStream = fs.createWriteStream(p);

    res.send(await new Promise((resolve) => {
        pump(file, writeStream).on("finish", ()=>{
            resolve({ ok: true });
        }).on("error", (e)=>{
            fastify.logger.error(`Failed to write to ${p}, ${e}`)
            resolve(new ShittierError(500, "Internal Server Error"));
        })
    }))
})

// TODO: Add auth
// uses post for cc compat
fastify.post("/file/delete/:filename", async (req, res) => {
    var filename = req.params.filename;
    
    if (!filename) return res.send(new ShittierError(400, "Bad Request", "Missing filename"));
    if (filename.length > 64) return res.send(new ShittierError(400, "Bad Request", "Filename too long"));
    if (sanitizeFilename(filename) != filename) return res.send(new ShittierError(400, "Bad Request", "Invalid filename"));

    var p = path.join(__dirname, "data", "files", filename);

    try {
        await fs.promises.stat(p);
    } catch (err) {
        if (err.code === "ENOENT") {
            return res.send(new ShittierError(400, "Bad Request", "File doesn't exist"));
        } else {
            fastify.logger.error(`Failed to stat file ${filename}, ${err.code}`);
            return res.send(new ShittierError(500, "Internal Server Error"));
        }
    }

    try {
        await fs.promises.unlink(p);    
    } catch (err) {
        fastify.logger.error(`Failed to unlink file ${filename}, ${err}`);
        return res.send(new ShittierError(500, "Internal Server Error"));
    }

    return res.send(await new Promise(async (resolve)=>{
        db.deleteLinksPointingToFile(filename).then(()=>{
            resolve({ ok: true })
        }).catch((err)=>{
            fastify.logger.error(`Failed to delete links pointing to file ${filename}, ${err}`);
            resolve(new ShittierError(500, "Internal Server Error"));
        });
    }))
})

// TODO: Add auth
// uses post for cc compat
fastify.post("/file/rename/:filename", async (req, res) => {
    var filename = req.params.filename;
    var newName = req.query.newName;

    if (!filename) return res.send(new ShittierError(400, "Bad Request", "Missing filename"));
    if (!newName) return res.send(new ShittierError(400, "Bad Request", "Missing newName"));
    if (filename.length > 64) return res.send(new ShittierError(400, "Bad Request", "Filename too long"));
    if (newName.length > 64) return res.send(new ShittierError(400, "Bad Request", "newName too long"));
    if (sanitizeFilename(filename) != filename) return res.send(new ShittierError(400, "Bad Request", "Invalid filename"));
    if (sanitizeFilename(newName) != newName) return res.send(new ShittierError(400, "Bad Request", "Invalid newName"));

    var p = path.join(__dirname, "data", "files", filename);

    try {
        await fs.promises.stat(p);
    } catch (err) {
        if (err.code === "ENOENT") {
            return res.send(new ShittierError(400, "Bad Request", "File doesn't exist"));
        } else {
            fastify.logger.error(`Failed to stat file ${filename}, ${err.code}`);
            return res.send(new ShittierError(500, "Internal Server Error"));
        }
    }

    // im sorry:
    let links
    await db.listLinks(filename).then(async (l)=>{
        links = l;
    }).catch((e)=>{
        fastify.logger.error(`Failed to list links to file ${filename}, ${e}`);
        links = new ShittierError(500, "Internal Server Error");
    });

    if (links instanceof ShittierError) return res.send(links);

    for (let i=0; i<links.length; i++) {
        let link = links[i];
        let err;

        await db.setLink(link, newName).catch((err)=>{
            fastify.logger.error(`Failed to set link ${link} from ${filename} to ${newName}, ${err}`);
            err = new ShittierError(500, "Internal Server Error");
        })

        if (err) {
            return res.send(err);
        }
    }


    await fs.promises.rename(p, path.join(__dirname, "data", "files", newName)).then(()=>{
        return res.send({ ok: true })
    }).catch((e)=>{
        fastify.logger.error(`Failed to rename file ${filename} to ${newName}, ${e}`);
        return res.send(new ShittierError(500, "Internal Server Error"));
    })
})

// TODO: Add auth
fastify.get("/file/list", async (req, res) => {
    var p = path.join(__dirname, "data", "files");

    return res.send(await new Promise((resolve)=>{
        fs.readdir(p, (err, data) => {
            if (err) {
                fastify.logger.error(`Failed to list dir ${p}, ${err}`);
                return resolve(new ShittierError(500, "Internal Server Error"));
            }

            return resolve({ ok: true, data: data })
        })
    }))
})

// TODO: Add auth
fastify.post("/link/create/:filename", async (req, res) => {
    var filename = req.params.filename;
    
    if (!filename) return res.send(new ShittierError(400, "Bad Request", "Missing filename"));
    if (filename.length > 64) return res.send(new ShittierError(400, "Bad Request", "Filename too long"));
    if (sanitizeFilename(filename) != filename) return res.send(new ShittierError(400, "Bad Request", "Invalid filename"));

    var p = path.join(__dirname, "data", "files", filename);

    try {
        await fs.promises.stat(p);
    } catch (err) {
        if (err.code === "ENOENT") {
            return res.send(new ShittierError(400, "Bad Request", "File doesn't exist"));
        } else {
            fastify.logger.error(`Failed to stat file ${filename}, ${err.code}`);
            return res.send(new ShittierError(500, "Internal Server Error"));
        }
    }

    return res.send(await new Promise((resolve) => {
        let id = generateID(8);

        db.addLink(id, filename).then(()=>{
            return resolve({ ok: true, link: id })
        }).catch((e)=>{
            fastify.logger.error(`Failed to create link for file ${filename}, ${e}`);
            return resolve(new ShittierError(500, "Internal Server Error"));
        })
    }))
})

// TODO: Add auth
fastify.post("/link/revoke/:linkid", async (req, res) => {
    var linkid = req.params.linkid;
    
    if (!linkid) return res.send(new ShittierError(400, "Bad Request", "Missing linkid"));
    if (linkid.length !== 8) return res.send(new ShittierError(400, "Bad Request", "Linkid incorrect size"));

    return res.send(await new Promise((resolve) => {
        db.revokeLink(linkid).then((success)=>{
            if (success) return resolve({ ok: true });
            return resolve(new ShittierError(400, "Bad Request", "Link doens't exist"))
        }).catch((e)=>{
            fastify.logger.error(`Failed to revoke link ${linkid}, ${e}`);
            return resolve(new ShittierError(500, "Internal Server Error"));
        })
    })) 
})

// TODO: Add auth
fastify.get("/link/list/:filename", async (req, res) => {
    var filename = req.params.filename;
    
    if (!filename) return res.send(new ShittierError(400, "Bad Request", "Missing filename"));
    if (filename.length > 64) return res.send(new ShittierError(400, "Bad Request", "Filename too long"));
    if (sanitizeFilename(filename) != filename) return res.send(new ShittierError(400, "Bad Request", "Invalid filename"));

    var p = path.join(__dirname, "data", "files", filename);

    try {
        await fs.promises.stat(p);
    } catch (err) {
        if (err.code === "ENOENT") {
            return res.send(new ShittierError(400, "Bad Request", "File doesn't exist"));
        } else {
            fastify.logger.error(`Failed to stat file ${filename}, ${err.code}`);
            return res.send(new ShittierError(500, "Internal Server Error"));
        }
    }

    return res.send(await new Promise((resolve) => {
        db.listLinks(filename).then((links)=>{
            return resolve({ ok: true, data: links });
        }).catch((e)=>{
            fastify.logger.error(`Failed to list links for ${filename}, ${e}`);
            return resolve(new ShittierError(500, "Internal Server Error"));
        })
    }))
})

// TODO: Add auth
fastify.get("/link/resolve/:linkid", async (req, res) => {
    var linkid = req.params.linkid;
    
    if (!linkid) return res.send(new ShittierError(400, "Bad Request", "Missing linkid"));
    if (linkid.length !== 8) return res.send(new ShittierError(400, "Bad Request", "Linkid incorrect size"));

    return res.send(await new Promise((resolve) => {
        db.resolveLink(linkid).then((data)=>{
            if (data) return resolve({ ok: true, data: data });
            return resolve(new ShittierError(400, "Bad Request", "Link doens't exist"))
        }).catch((e)=>{
            fastify.logger.error(`Failed to resolve link ${linkid}, ${e}`);
            return resolve(new ShittierError(500, "Internal Server Error"));
        })
    })) 
})

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
    */
});


async function returnJWT(req, res) {
  const jwtExpiry = DateTime.now().plus({ days: 365 });
  const jwt = req.server.jwt.sign(
    {
      ok: true
    },
    {
      expiresIn: "365d",
    }
  );

  res
    .setCookie("token", jwt, {
      domain: "localhost",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: true,
      expires: jwtExpiry.toJSDate(),
    })
    .send({
      username: user.username,
      jwt,
      expiry: jwtExpiry.toJSDate(),
    });
}

fastify.listen({ port: 6900 }, ( err ) => {
  if (err) throw err
  fastify.logger.info(`Server listening on ${fastify.server.address().port}`)
})