import mongoose from "mongoose";

const Db_Connection = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING);
    console.log("Database Connected");
  } catch (err) {
    console.log("Database Connection error", err.message);
    process.exit(1);
  }
};
export default Db_Connection;
