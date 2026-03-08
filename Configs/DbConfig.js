import mongoose from "mongoose";

const Connection_String = process.env.CONNECTION_STRING
const DbConnection = async () => {
    try{
        await mongoose.connect(Connection_String)
        console.log("DataBase connected successfully !");
    }
    catch(err){
        console.log("Database Connection error");
        process.exit(1);

    }
    
}
export default DbConnection;