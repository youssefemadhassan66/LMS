import mongoose from "mongoose";

const Connection_String = process.env.CONNECTION_STRING
console.log(Connection_String)

const Db_Connection = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING)
    console.log('Database Connected')
    console.log('DB STRING:', process.env.CONNECTION_STRING)
  } catch (err) {
    console.log('Database Connection error', err.message)
    process.exit(1)
  }
}
export default Db_Connection;