import bcrypt from "bcryptjs";


async function hashPasswordHelper(plainPassword) {
    const Salt_Rounds = process.env.Salt_Rounds;
    return await bcrypt.hash(plainPassword,parseInt(Salt_Rounds))
}

async function ComparePasswordHelper(plainPassword,hashedPassword)
{
    return  await bcrypt.compare(plainPassword,hashedPassword)
}


export {
    hashPasswordHelper,
    ComparePasswordHelper
}