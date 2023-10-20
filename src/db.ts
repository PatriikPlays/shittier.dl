// import sqlite3 from 'sqlite3';
// import path from "node:path";
// import { fileURLToPath } from 'node:url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// class DB {
//     constructor() {
//         this.db = new sqlite3.Database(path.join(__dirname, "data", "db.sqlite"));

//         this.db.serialize(() => {
//             this.db.run("CREATE TABLE IF NOT EXISTS links (link_id TEXT, filename TEXT)")
//         })
//     }

//     resolveLink(link) {
//         return new Promise((resolve, reject) => {
//             this.db.get("SELECT filename FROM links WHERE link_id = ?", [link], (err, row) => {
//                 if (err) {
//                     return reject(err);
//                 }
//                 if (row) {
//                     resolve(row.filename);
//                 } else {
//                     resolve(null);
//                 }
//             })
//         })
//     }

//     addLink(link, filename) {
//         return new Promise((resolve, reject) => {
//             this.db.run("INSERT INTO links (link_id, filename) VALUES (?, ?)", [link, filename], function(err) {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     resolve();
//                 }
//             });
//         });
//     }

//     setLink(link, filename) {
//         return new Promise((resolve, reject) => {
//             this.db.run("UPDATE links SET filename = ? WHERE link_id = ?", [filename, link], function(err) {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     resolve();
//                 }
//             });
//         });
//     }

//     revokeLink(link) {
//         return new Promise((resolve, reject) => {
//             this.db.run("DELETE FROM links WHERE link_id = ?", [link], function(err) {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     resolve(this.changes > 0);
//                 }
//             });
//         });
//     }

//     listLinks(filename) {
//         return new Promise((resolve, reject) => {
//             this.db.all("SELECT link_id FROM links WHERE filename = ?", [filename], function(err, rows) {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     resolve(rows.map(row => row.link_id));
//                 }
//             });
//         })
//     }

//     deleteLinksPointingToFile(filename) {
//         return new Promise((resolve, reject) => {
//             this.db.run("DELETE FROM links WHERE filename = ?", [filename], function(err) {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     resolve();
//                 }
//             });
//         });
//     }
// }

// export default DB;
