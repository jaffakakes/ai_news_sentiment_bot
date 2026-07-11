import { Parser } from "htmlparser2";

/**
 * One streaming pass over an HTML document collecting everything the
 * generic provider needs. No DOM is built — htmlparser2 SAX callbacks feed
 * plain collections, which pairs naturally with the fetcher's byte cap.
 */
export interface PageMeta {
  /** meta name/property → first content value seen */
  meta: Map<string, string>;
  title: string;
  canonical: string | null;
  jsonLdBlocks: string[]; // raw script bodies, parsed (leniently) by the caller
  timeDatetimes: string[]; // <time datetime="..."> values in document order
  paragraphs: string[]; // first substantial <p> texts (detector input)
}

const MAX_PARAGRAPHS = 5;
const MIN_PARAGRAPH_CHARS = 60;
const MAX_PARAGRAPH_TOTAL = 2000;

export function collectPageMeta(html: string): PageMeta {
  const result: PageMeta = {
    meta: new Map(),
    title: "",
    canonical: null,
    jsonLdBlocks: [],
    timeDatetimes: [],
    paragraphs: [],
  };

  let inTitle = false;
  let inJsonLd = false;
  let jsonLdBuffer = "";
  let paragraphDepth = 0;
  let paragraphBuffer = "";
  let paragraphTotal = 0;

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name === "meta") {
          const key = attribs.property ?? attribs.name ?? attribs.itemprop;
          const content = attribs.content;
          if (key && content && !result.meta.has(key.toLowerCase())) {
            result.meta.set(key.toLowerCase(), content);
          }
        } else if (name === "title" && !result.title) {
          inTitle = true;
        } else if (name === "link" && attribs.rel === "canonical" && attribs.href) {
          result.canonical ??= attribs.href;
        } else if (
          name === "script" &&
          attribs.type?.toLowerCase() === "application/ld+json"
        ) {
          inJsonLd = true;
          jsonLdBuffer = "";
        } else if (name === "time" && attribs.datetime) {
          result.timeDatetimes.push(attribs.datetime);
        } else if (
          name === "p" &&
          result.paragraphs.length < MAX_PARAGRAPHS &&
          paragraphTotal < MAX_PARAGRAPH_TOTAL
        ) {
          paragraphDepth++;
        }
      },
      ontext(text) {
        if (inTitle) result.title += text;
        if (inJsonLd) jsonLdBuffer += text;
        if (paragraphDepth > 0) paragraphBuffer += text;
      },
      onclosetag(name) {
        if (name === "title") inTitle = false;
        if (name === "script" && inJsonLd) {
          inJsonLd = false;
          if (jsonLdBuffer.trim()) result.jsonLdBlocks.push(jsonLdBuffer);
        }
        if (name === "p" && paragraphDepth > 0) {
          paragraphDepth--;
          if (paragraphDepth === 0) {
            const text = paragraphBuffer.replace(/\s+/g, " ").trim();
            paragraphBuffer = "";
            if (text.length >= MIN_PARAGRAPH_CHARS) {
              result.paragraphs.push(text);
              paragraphTotal += text.length;
            }
          }
        }
      },
    },
    { decodeEntities: true },
  );

  parser.write(html);
  parser.end();

  result.title = result.title.replace(/\s+/g, " ").trim();
  return result;
}
