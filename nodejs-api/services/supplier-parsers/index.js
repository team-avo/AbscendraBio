// Registry of supplier email parsers.
//
// A parser takes the raw HTML body of a supplier order-confirmation email
// and returns { orderNumber, lines: [{ supplierProductName, parsedQuantity }] }.
//
// Adding a new supplier:
//   1. Create services/supplier-parsers/<key>.js exporting `parse(html) => { ... }`
//   2. Register the key in PARSERS below
//   3. Create a SupplierEmailSource row in the database with parserKey = <key>

const { ParseError } = require("./index-shared");
const ionPeptideV1 = require("./ion-peptide-v1");

const PARSERS = {
  ion_peptide_v1: ionPeptideV1,
};

function listParserKeys() {
  return Object.keys(PARSERS);
}

function parse(parserKey, html) {
  const parser = PARSERS[parserKey];
  if (!parser) {
    throw new ParseError(`Unknown parser: ${parserKey}`);
  }
  return parser.parse(html);
}

module.exports = { parse, listParserKeys, ParseError };
