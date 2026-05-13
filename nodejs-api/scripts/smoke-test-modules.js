// Quick smoke test: load all newly-touched modules and ensure they parse.
require("dotenv").config();
require("../routes/inventory");
require("../services/inventory.service");
require("../services/supplier-parsers");
console.log("OK: all modules load cleanly");
