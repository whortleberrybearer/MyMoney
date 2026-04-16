/**
 * Lightweight OFX/QFX parser.
 *
 * Supports OFX SGML (v1.x) and OFX XML (v2.x) formats. QFX files are
 * structurally identical to OFX and are handled without distinction.
 *
 * Only the fields required for transaction import are extracted:
 *   - Per transaction: FITID, DTPOSTED, TRNAMT, NAME / MEMO, TRNTYPE
 *   - Statement level: LEDGERBAL (BALAMT + DTASOF)
 */

export type OfxTransaction = {
  fitid: string;
  date: string; // ISO YYYY-MM-DD
  amount: number; // signed real: positive = credit, negative = debit
  name: string | null;     // OFX NAME field → payee
  memo: string | null;     // OFX MEMO field → notes
  checkNum: string | null; // OFX CHECKNUM field → reference
  type: string;
};

export type OfxStatement = {
  transactions: OfxTransaction[];
  closingBalance: number | null;
  closingBalanceDate: string | null;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse OFX or QFX file contents and return a typed statement object.
 * Throws an `Error` with a descriptive message if the content is invalid.
 */
export function parseOfx(content: string): OfxStatement {
  const trimmed = content.trim();

  if (isXmlFormat(trimmed)) {
    return parseXml(trimmed);
  }
  return parseSgml(trimmed);
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

function isXmlFormat(content: string): boolean {
  return /^<\?xml/i.test(content) || /^<\?OFX/i.test(content);
}

// ---------------------------------------------------------------------------
// SGML parser (OFX v1.x)
// ---------------------------------------------------------------------------

function parseSgml(content: string): OfxStatement {
  // OFX SGML files have a header block of KEY:VALUE lines before <OFX>
  const ofxStart = content.indexOf("<OFX>");
  if (ofxStart === -1) {
    throw new Error(
      "Invalid OFX file: <OFX> tag not found. The file may not be a valid OFX/QFX file.",
    );
  }
  const body = content.substring(ofxStart);

  const transactions = extractSgmlTransactions(body);
  const { closingBalance, closingBalanceDate } = extractSgmlLedgerBal(body);

  return { transactions, closingBalance, closingBalanceDate };
}

function extractSgmlTransactions(body: string): OfxTransaction[] {
  const results: OfxTransaction[] = [];

  // STMTTRN blocks — closing tag is required in SGML for aggregate elements
  const blockRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(body)) !== null) {
    const block = match[1];

    const fitid = sgmlLeaf(block, "FITID");
    const dtposted = sgmlLeaf(block, "DTPOSTED");
    const trnamt = sgmlLeaf(block, "TRNAMT");
    const name = sgmlLeaf(block, "NAME");
    const memo = sgmlLeaf(block, "MEMO");
    const checkNum = sgmlLeaf(block, "CHECKNUM");
    const trntype = sgmlLeaf(block, "TRNTYPE") ?? "";

    if (!fitid || !dtposted || trnamt === null) continue;

    results.push({
      fitid,
      date: ofxDateToIso(dtposted),
      amount: parseFloat(trnamt),
      name,
      memo,
      checkNum,
      type: trntype,
    });
  }

  return results;
}

function extractSgmlLedgerBal(
  body: string,
): Pick<OfxStatement, "closingBalance" | "closingBalanceDate"> {
  // LEDGERBAL is an aggregate element — match from opening to closing tag.
  // In OFX SGML v1.x, aggregate elements always have explicit closing tags
  // even though leaf elements (like BALAMT) do not.
  const ledgerMatch = body.match(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i);
  if (!ledgerMatch) {
    return { closingBalance: null, closingBalanceDate: null };
  }

  const block = ledgerMatch[1];
  const balamt = sgmlLeaf(block, "BALAMT");
  const dtasof = sgmlLeaf(block, "DTASOF");

  if (balamt === null) {
    return { closingBalance: null, closingBalanceDate: null };
  }

  return {
    closingBalance: parseFloat(balamt),
    closingBalanceDate: dtasof ? ofxDateToIso(dtasof) : null,
  };
}

/**
 * Extract a leaf element value from an SGML block.
 * Leaf elements look like: `<TAG>value` (no closing tag required).
 * Returns null if the tag is not present.
 */
function sgmlLeaf(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = block.match(regex);
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// XML parser (OFX v2.x)
// ---------------------------------------------------------------------------

function parseXml(content: string): OfxStatement {
  // Strip the OFX processing instruction header if present
  const xmlBody = content.replace(/<\?OFX[^>]*\?>/i, "").trim();

  // Simple tag extraction using regex — avoids a DOMParser dependency in tests
  const transactions = extractXmlTransactions(xmlBody);
  const { closingBalance, closingBalanceDate } = extractXmlLedgerBal(xmlBody);

  if (transactions.length === 0 && !xmlBody.includes("<STMTTRN>")) {
    throw new Error(
      "Invalid OFX file: no transaction data found. The file may not be a valid OFX/QFX file.",
    );
  }

  return { transactions, closingBalance, closingBalanceDate };
}

function extractXmlTransactions(body: string): OfxTransaction[] {
  const results: OfxTransaction[] = [];
  const blockRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(body)) !== null) {
    const block = match[1];

    const fitid = xmlTag(block, "FITID");
    const dtposted = xmlTag(block, "DTPOSTED");
    const trnamt = xmlTag(block, "TRNAMT");
    const name = xmlTag(block, "NAME");
    const memo = xmlTag(block, "MEMO");
    const checkNum = xmlTag(block, "CHECKNUM");
    const trntype = xmlTag(block, "TRNTYPE") ?? "";

    if (!fitid || !dtposted || trnamt === null) continue;

    results.push({
      fitid,
      date: ofxDateToIso(dtposted),
      amount: parseFloat(trnamt),
      name,
      memo,
      checkNum,
      type: trntype,
    });
  }

  return results;
}

function extractXmlLedgerBal(
  body: string,
): Pick<OfxStatement, "closingBalance" | "closingBalanceDate"> {
  const ledgerMatch = body.match(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i);
  if (!ledgerMatch) {
    return { closingBalance: null, closingBalanceDate: null };
  }

  const block = ledgerMatch[1];
  const balamt = xmlTag(block, "BALAMT");
  const dtasof = xmlTag(block, "DTASOF");

  if (balamt === null) {
    return { closingBalance: null, closingBalanceDate: null };
  }

  return {
    closingBalance: parseFloat(balamt),
    closingBalanceDate: dtasof ? ofxDateToIso(dtasof) : null,
  };
}

/** Extract content of an XML tag. Returns null if tag not present. */
function xmlTag(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, "i");
  const m = block.match(regex);
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

/**
 * Convert an OFX date string to ISO YYYY-MM-DD.
 * OFX date format: YYYYMMDD[HHMMSS[.XXX][[-+]HH:MM[:TZNAME]]]
 */
function ofxDateToIso(ofxDate: string): string {
  // Strip time zone info in brackets, e.g. [0:GMT]
  const clean = ofxDate.replace(/\[.*\]/, "").trim();
  const year = clean.substring(0, 4);
  const month = clean.substring(4, 6);
  const day = clean.substring(6, 8);
  return `${year}-${month}-${day}`;
}
