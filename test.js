const bcrypt = require('bcrypt');
//import 'bcrypt';


const salt = 10;

bcrypt.hash(userPassword, salt, (err, hash) => {
    console.log('Hashed password:', hash);
});