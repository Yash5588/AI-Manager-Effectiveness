const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");

dotenv.config({ path: path.join(__dirname, ".env") });
const app = require("./app");

require("./schedulers/emailScheduler");
require("./schedulers/snapshotScheduler");
require("./schedulers/suggestionsScheduler");

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(() => {
    process.exit(1);
  });
