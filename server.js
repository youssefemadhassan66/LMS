import "dotenv/config";
import app from "./App.js";
import Db_Connection from "./Configs/DbConfig.js";
import { validateEnv } from "./Configs/validateEnv.js";

const PortNumber = process.env.PORT;

async function StartServer() {
  try {
    validateEnv();

    await Db_Connection();

    const server = app.listen(PortNumber, () => {
      console.log(`Server is running on port ${PortNumber}`);
    });
    process.on("unhandledRejection", (err) => {
      console.log("unhandledRejection app is shuting down");
      console.log(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });
  } catch (error) {
    console.log("Failed to start the server ", error);
    process.exit(1);
  }
}

StartServer();
