// 生成五位随机数
function randomCode (n) {
  const chars = ["0","1","2","3","4","5","6","7","8","9"];
  let res = "";
  for (let i = 0; i < n; i++) {
    const id = Math.floor(Math.random() * 10)
    res += chars[id]
  }
  return res
}

module.exports = randomCode
