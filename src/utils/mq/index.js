const { Queue } = require("bullmq");
const { MQConnection, MQDefaultJobOptions } = require("../../../project.config.js");
const connection = {
  host: MQConnection.host,
  port: MQConnection.port,
  db: MQConnection.db
};

exports.myQueue = new Queue("myQueue", {
  connection,
  defaultJobOptions: MQDefaultJobOptions // 默认作业选项
});
