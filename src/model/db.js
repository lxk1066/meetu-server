const mysql = require('mysql')
const { DB } = require('../../project.config.js')

let pool = mysql.createPool({
  host: DB.host,
  user: DB.user,
  password: DB.password,
  database: DB.database
});

function queryDB(sql) {
  return new Promise((resolve, reject) => {
    if (pool) {
      pool.getConnection((err, connection) => {
        if (err) {
          reject(err)
        } else {
          connection.query(sql, function (err, results) {
            if (err) {
              reject(err)
            } else {
              resolve(results)
            }
            // 结束会话
            connection.release()
          });
        }
      })
    } else {
      reject("数据库连接失败！")
    }
  })
}

module.exports = queryDB;
