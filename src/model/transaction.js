const mysql = require("mysql");
const { DB } = require("../../project.config.js");

// 创建连接池
let pool = mysql.createPool({
  host: DB.host,
  port: DB.port || 3306,
  user: DB.user,
  password: DB.password,
  database: DB.database
});

/**
 * mysql 事务处理
 * @param {Array} sqls 需要执行的sql语句数组
 * @returns {Promise} 返回一个Promise
 */

function transaction(sqls) {
  return new Promise((resolve, reject) => {
    pool.getConnection(function (err, connection) {
      // 连接失败 promise直接返回失败
      if (err) {
        return reject(err);
      }

      // 开始执行事务
      connection.beginTransaction(beginErr => {
        // 创建事务失败
        if (beginErr) {
          connection.release();
          return reject(beginErr);
        }
        console.log("开始执行事务，共执行" + sqls.length + "条语句");
        // 返回一个promise 数组
        let funcAry = sqls.map(sql => {
          return new Promise((sqlResolve, sqlReject) => {
            connection.query(sql, (sqlErr, result) => {
              if (sqlErr) {
                return sqlReject(sqlErr);
              }
              sqlResolve(result);
            });
          });
        });
        // 使用 Promise.all方法 对里面的每个promise执行的状态 检查
        Promise.all(funcAry)
          .then(arrResult => {
            // 若每个sql语句都执行成功了 才会走到这里 在这里需要提交事务，前面的sql执行才会生效
            // 提交事务
            connection.commit((commitErr, info) => {
              if (commitErr) {
                // 提交事务失败了
                console.log("提交事务失败:" + commitErr);
                // 事务回滚，之前运行的sql语句不生效
                connection.rollback(function (err) {
                  if (err) console.log("事务回滚失败：" + err);
                  connection.release();
                });
                // 返回promise失败状态
                return reject(commitErr);
              }

              connection.release();
              // 事务成功 返回 每个sql运行的结果 是个数组结构
              resolve(arrResult);
            });
          })
          .catch(error => {
            // 多条sql语句执行中 其中有一条报错 直接回滚
            connection.rollback(function () {
              console.log("sql事务运行失败： " + error);
              connection.release();
              reject(error);
            });
          });
      });
    });
  });
}

module.exports = {
  transaction
};

// 作者：jq玩的起飞
// 链接：https://juejin.cn/post/7025777763374071844
// 来源：稀土掘金
// 著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。
