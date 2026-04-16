import { describe, it, expect } from "vitest";
import { parseOfx } from "@/lib/ofx-parser";

// ---------------------------------------------------------------------------
// Sample OFX fixtures
// ---------------------------------------------------------------------------

const OFX_SGML_WITH_BALANCE = `
OFXHEADER:100
DATA:OFXSGML
VERSION:151

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>GBP
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115000000
<TRNAMT>-50.00
<FITID>TX001
<NAME>Tesco
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20240120000000
<TRNAMT>1200.00
<FITID>TX002
<NAME>Salary
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1234.56
<DTASOF>20240131
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`.trim();

const OFX_SGML_NO_BALANCE = `
OFXHEADER:100
DATA:OFXSGML
VERSION:151

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>-25.00
<FITID>TX100
<MEMO>Coffee shop
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`.trim();

// QFX is structurally identical to OFX (just a Quicken variant)
const QFX_CONTENT = OFX_SGML_WITH_BALANCE;

const OFX_XML_WITH_BALANCE = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>GBP</CURDEF>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20240115000000</DTPOSTED>
<TRNAMT>-50.00</TRNAMT>
<FITID>TX001</FITID>
<NAME>Tesco</NAME>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20240120000000</DTPOSTED>
<TRNAMT>1200.00</TRNAMT>
<FITID>TX002</FITID>
<NAME>Salary</NAME>
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1234.56</BALAMT>
<DTASOF>20240131</DTASOF>
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

// ---------------------------------------------------------------------------
// SGML format tests
// ---------------------------------------------------------------------------

describe("parseOfx — SGML format", () => {
  it("parses a valid SGML OFX file to the correct transaction list", () => {
    const result = parseOfx(OFX_SGML_WITH_BALANCE);

    expect(result.transactions).toHaveLength(2);

    expect(result.transactions[0]).toEqual({
      fitid: "TX001",
      date: "2024-01-15",
      amount: -50,
      name: "Tesco",
      memo: null,
      checkNum: null,
      type: "DEBIT",
    });

    expect(result.transactions[1]).toEqual({
      fitid: "TX002",
      date: "2024-01-20",
      amount: 1200,
      name: "Salary",
      memo: null,
      checkNum: null,
      type: "CREDIT",
    });
  });

  it("extracts closing balance and date when LEDGERBAL is present", () => {
    const result = parseOfx(OFX_SGML_WITH_BALANCE);

    expect(result.closingBalance).toBe(1234.56);
    expect(result.closingBalanceDate).toBe("2024-01-31");
  });

  it("returns closingBalance = null when LEDGERBAL is absent", () => {
    const result = parseOfx(OFX_SGML_NO_BALANCE);

    expect(result.closingBalance).toBeNull();
    expect(result.closingBalanceDate).toBeNull();
  });

  it("uses MEMO field when NAME is absent", () => {
    const result = parseOfx(OFX_SGML_NO_BALANCE);

    expect(result.transactions[0].memo).toBe("Coffee shop");
  });

  it("parses short date (YYYYMMDD) without time component", () => {
    const result = parseOfx(OFX_SGML_NO_BALANCE);

    expect(result.transactions[0].date).toBe("2024-01-15");
  });

  it("throws a descriptive error for structurally invalid content", () => {
    expect(() => parseOfx("This is not an OFX file")).toThrow(
      /Invalid OFX file/i,
    );
  });

  it("throws when <OFX> tag is missing", () => {
    expect(() => parseOfx("OFXHEADER:100\nDATA:OFXSGML\n<DATA>something")).toThrow(
      /<OFX> tag not found/i,
    );
  });
});

// ---------------------------------------------------------------------------
// QFX (identical to OFX)
// ---------------------------------------------------------------------------

describe("parseOfx — QFX files (same as OFX)", () => {
  it("parses a QFX file identically to the equivalent OFX file", () => {
    const ofxResult = parseOfx(OFX_SGML_WITH_BALANCE);
    const qfxResult = parseOfx(QFX_CONTENT);

    expect(qfxResult).toEqual(ofxResult);
  });
});

// ---------------------------------------------------------------------------
// XML format tests
// ---------------------------------------------------------------------------

describe("parseOfx — XML format (OFX v2.x)", () => {
  it("parses a valid XML OFX file to the correct transaction list", () => {
    const result = parseOfx(OFX_XML_WITH_BALANCE);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].fitid).toBe("TX001");
    expect(result.transactions[0].amount).toBe(-50);
    expect(result.transactions[0].date).toBe("2024-01-15");
  });

  it("extracts closing balance from XML format", () => {
    const result = parseOfx(OFX_XML_WITH_BALANCE);

    expect(result.closingBalance).toBe(1234.56);
    expect(result.closingBalanceDate).toBe("2024-01-31");
  });
});
