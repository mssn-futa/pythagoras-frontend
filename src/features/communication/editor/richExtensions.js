import { Blockquote } from "@tiptap/extension-blockquote";
import { Bold } from "@tiptap/extension-bold";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Heading } from "@tiptap/extension-heading";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";
import { LINK_PROTOCOLS, validateLinkUrl } from "./richContent.js";

/*
 * The editor schema is exactly the D4 allowlist (p/br/strong/em/h2/h3/ul/ol/li/
 * blockquote/a) and nothing else: no StarterKit, so no underline, strike, code,
 * code blocks, rules, images or tables. ProseMirror parses pasted/dropped HTML
 * through this schema, so anything outside it is reduced to its text. Links parse
 * only when the href passes the http/https policy. The server re-sanitizes on
 * save, preview and queue; this is usability, not the security boundary.
 */

// Tab keeps its browser meaning (leave the editor) instead of nesting list items.
const FlatListItem = ListItem.extend({
  addKeyboardShortcuts() {
    const { Tab, "Shift-Tab": shiftTab, ...rest } = this.parent?.() ?? {};
    void Tab;
    void shiftTab;
    return rest;
  },
});

// Only href is kept: pasted target/rel/class/title are never carried into the document.
const LinkHrefOnly = Link.extend({
  addAttributes() {
    return { href: { default: null } };
  },
});

export const richExtensions = () => [
  Document,
  Paragraph,
  Text,
  Bold,
  Italic,
  Heading.configure({ levels: [2, 3] }),
  BulletList,
  OrderedList,
  FlatListItem,
  Blockquote,
  HardBreak,
  LinkHrefOnly.configure({
    openOnClick: false,
    autolink: false,
    linkOnPaste: true,
    protocols: [...LINK_PROTOCOLS],
    defaultProtocol: "https",
    HTMLAttributes: { rel: null, target: null, class: null },
    isAllowedUri: (url) => validateLinkUrl(url).ok,
  }),
  UndoRedo,
];
