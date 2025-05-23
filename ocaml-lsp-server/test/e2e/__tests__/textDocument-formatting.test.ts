import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as Protocol from "vscode-languageserver-protocol";
import * as Types from "vscode-languageserver-types";
import * as LanguageServer from "../src/LanguageServer";

const ocamlFormat = `
break-cases=all
break-separators=before
break-sequences=true
cases-exp-indent=2
doc-comments=before
dock-collection-brackets=false
field-space=loose
if-then-else=k-r
indicate-nested-or-patterns=unsafe-no
let-and=sparse
sequence-style=terminator
space-around-arrays
space-around-lists
space-around-records
type-decl=sparse
wrap-comments=true
`;

function setupOcamlFormat(ocamlFormat: string) {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "ocamllsp-test-"));
  fs.writeFileSync(path.join(tmpdir, ".ocamlformat"), ocamlFormat);
  return tmpdir;
}

function openDocument(
  languageServer: LanguageServer.LanguageServer,
  source: string,
  name: string,
) {
  languageServer.sendNotification(
    Protocol.DidOpenTextDocumentNotification.type,
    {
      textDocument: Types.TextDocumentItem.create(name, "ocaml", 0, source),
    },
  );
}

async function query(
  languageServer: LanguageServer.LanguageServer,
  name: string,
) {
  return await languageServer.sendRequest(
    Protocol.DocumentFormattingRequest.type,
    {
      textDocument: Types.TextDocumentIdentifier.create(name),
      options: Types.FormattingOptions.create(2, true),
    },
  );
}

const maybeDescribe = os.type() === "Windows_NT" ? describe.skip : describe;

maybeDescribe("textDocument/formatting", () => {
  maybeDescribe("reformatter binary present", () => {
    let languageServer: LanguageServer.LanguageServer;

    afterEach(async () => {
      await LanguageServer.exit(languageServer);
    });

    it("can format an ocaml impl file", async () => {
      languageServer = await LanguageServer.startAndInitialize();

      const name = path.join(setupOcamlFormat(ocamlFormat), "test.ml");

      openDocument(
        languageServer,
        "let rec gcd a b =\n" +
          "  match (a, b) with\n" +
          "    | 0, n\n" +
          "  | n, 0 ->\n" +
          "    n\n" +
          "  | _, _ -> gcd a (b mod a)\n",
        name,
      );

      const result = await query(languageServer, name);
      expect(result).toMatchInlineSnapshot(`
[
  {
    "newText": "  | 0, n
",
    "range": {
      "end": {
        "character": 0,
        "line": 3,
      },
      "start": {
        "character": 0,
        "line": 2,
      },
    },
  },
]
`);
    });

    it("leaves unchanged files alone", async () => {
      languageServer = await LanguageServer.startAndInitialize();

      const name = path.join(setupOcamlFormat(ocamlFormat), "test.ml");

      openDocument(
        languageServer,
        "let rec gcd a b =\n" +
          "  match (a, b) with\n" +
          "  | 0, n\n" +
          "  | n, 0 ->\n" +
          "    n\n" +
          "  | _, _ -> gcd a (b mod a)\n",
        name,
      );

      const result = await query(languageServer, name);
      expect(result).toMatchObject([]);
    });

    it("can format an ocaml intf file", async () => {
      languageServer = await LanguageServer.startAndInitialize();

      const name = path.join(setupOcamlFormat(ocamlFormat), "test.mli");

      openDocument(
        languageServer,
        "module Test :           sig\n  type t =\n    | Foo\n    | Bar\n    | Baz\nend\n",
        name,
      );

      const result = await query(languageServer, name);

      expect(result).toMatchInlineSnapshot(`
[
  {
    "newText": "module Test : sig
",
    "range": {
      "end": {
        "character": 0,
        "line": 1,
      },
      "start": {
        "character": 0,
        "line": 0,
      },
    },
  },
]
`);
    });

    it("does not format ignored files", async () => {
      languageServer = await LanguageServer.startAndInitialize();

      const tmpdir = setupOcamlFormat(ocamlFormat);

      const ocamlFormatIgnore = path.join(tmpdir, ".ocamlformat-ignore");
      fs.writeFileSync(ocamlFormatIgnore, "test.ml\n");

      const name = path.join(tmpdir, "test.ml");

      openDocument(
        languageServer,
        "let rec gcd a b = match (a, b) with\n" +
          "  | 0, n\n" +
          "  | n, 0 ->\n" +
          "    n\n" +
          "  | _, _ -> gcd a (b mod a)\n",
        name,
      );

      const result = await query(languageServer, name);
      expect(result).toMatchObject([]);
    });
  });
});
