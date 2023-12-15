const queryDB = require("../model/db");

class Base {
  // 返回请求到达服务器的时间，用于计算时钟误差
  async calculateClockError(ctx) {
    const time = Date.now();
    const end = process.hrtime(ctx.hrtime); // 计算时间差
    const diff = Math.round((end[0] * 1e9 + end[1]) / 1e6); // 单位毫秒
    return (ctx.body = { code: 200, msg: "ok", date: time - diff });
  }

  async getInfoConfig(ctx) {
    let { type = "", name = "" } = ctx.request.query;
    if ((!name.trim() && !type.trim()) || (name.trim() && type.trim())) {
      return (ctx.body = { code: 400, msg: "参数 type 或 name 必须二选一" });
    } else if ((name && !/[A-Za-z0-9]+/.test(name)) || (type && !/[A-Za-z0-9]+/.test(type))) {
      return (ctx.body = { code: 400, msg: "name 或 type 只能包含大小写字母和数字" });
    } else {
      // type 和 name 二选一 name优先
      let sql = "";
      if (name.trim()) {
        sql = `select * from meetu_info where name = '${name}' and disabled = 0`;
      } else if (type.trim()) {
        sql = `select * from meetu_info where type like '${type}' and disabled = 0`;
      }

      const res = await queryDB(sql).catch(err => {
        console.error("Base getInfoConfig Error:", err);
        return (ctx.body = { code: 500, msg: "SQL错误" });
      });

      return (ctx.body = { code: 200, msg: "ok", data: name ? res[0] : res });
    }
  }
}

module.exports = new Base();
