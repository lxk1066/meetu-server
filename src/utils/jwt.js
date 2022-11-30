const jwt = require('jsonwebtoken')
const { promisify } = require('util')

exports.sign = promisify(jwt.sign)
exports.verify = promisify(jwt.verify)
exports.decode = promisify(jwt.decode)

// jwt.sign({
//   userId: 123
// }, 'xxxxxxxx', { expiresIn: '72h' }, (err, token) => {
//   console.log(token)
// })

// jwt.verify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywiaWF0IjoxNjYzMjM5OTUxLCJleHAiOjE2NjM0OTkxNTF9.jwepoSW7p8dkecDuqGun3pG4wchUIZ6cJ2FscTZ10qE', 'xxxxxxx', { algorithms: "HS256" }, (err, decoded) => {
//   if (err) {
//     console.log("jwt验证失败")
//   }
//   console.log(decoded)
// })
