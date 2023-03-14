const { originHosts } = require("../../project.config");

exports.originConf = ctx => {
  // 设置多个跨域域名
  const allowCross = originHosts;
  // header.referer 代表当前请求的来源地址，如果referer为空，代表是通过浏览器直接访问的或者是通过api测试工具直接调用
  // 默认不允许空referer访问
  ctx.header.referer = ctx.header.referer ? ctx.header.referer : "";
  const url = ctx.header.referer.substring(0, ctx.header.referer.length - 1);
  if (allowCross.includes(url)) return url;
  // return 'http://127.0.0.1:8000'
};
