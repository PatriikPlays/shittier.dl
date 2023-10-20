import sqlite3 from 'sqlite3';

class DB {
    db: sqlite3.Database;

    constructor(path: string) {
        this.db = new sqlite3.Database(path);

        this.db.serialize(() => {
            this.db.run("CREATE TABLE IF NOT EXISTS links (link_id TEXT, filename TEXT)")
        })
    }

    resolveLink(link: string) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT filename FROM links WHERE link_id = ?", [link], (err, row: any) => {
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

    addLink(link: string, filename: string) {
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO links (link_id, filename) VALUES (?, ?)", [link, filename], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(undefined);
                }
            });
        });
    }

    setLink(link: string, filename: string) {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE links SET filename = ? WHERE link_id = ?", [filename, link], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(undefined);
                }
            });
        });
    }

    revokeLink(link: string) {
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

    listLinks(filename: string) {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT link_id FROM links WHERE filename = ?", [filename], function(err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map((row: any) => row.link_id));
                }
            });
        })
    }

    deleteLinksPointingToFile(filename: string) {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM links WHERE filename = ?", [filename], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(null);
                }
            });
        });
    }
}

export default DB;
