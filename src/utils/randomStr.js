// 生成五位随机数（大小写字母）
function randomStr (n) {
  const chars = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];
  let res = "";
  for (let i = 0; i < n; i++) {
    const id = Math.floor(Math.random() * 52)
    res += chars[id]
  }
  return res
}

module.exports = randomStr
