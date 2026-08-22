import PizZip from "pizzip";

export type GeneratedDocumentFields = {
  processNumber: string;
  applicant: string;
  propertyRegistration: string;
  lot: string;
  block: string;
  neighborhood: string;
  address: string;
  postalCode: string;
  request: string;
  category: string;
  actionType: string;
  zoning: string;
  coordinates: string;
  area: string;
  cnae: string;
  cnpj: string;
};

type DocumentImage = {
  blob: Blob;
  title: string;
  pageBreakBefore?: boolean;
};

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function replaceTokens(xml: string, fields: GeneratedDocumentFields) {
  let result = xml;
  for (const [key, value] of Object.entries(fields)) {
    result = result.replaceAll(`{{${key}}}`, escapeXml(value || "—"));
  }
  return result;
}

async function blobBytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function imageSize(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

async function imageForMedia(blob: Blob, mediaPath: string) {
  if (!/\.jpe?g$/i.test(mediaPath)) return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = window.document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return blob;
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível adaptar a imagem ao modelo.")), "image/jpeg", 0.9));
}

function drawingXml(relationshipId: string, documentPropertyId: number, name: string, width: number, height: number) {
  const maxWidth = 5_850_000;
  const maxHeight = 8_000_000;
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  const cx = Math.round(width * ratio);
  const cy = Math.round(height * ratio);
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${documentPropertyId}" name="${escapeXml(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${escapeXml(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function headingXml(title: string, pageBreakBefore: boolean) {
  const pageBreak = pageBreakBefore ? `<w:p><w:r><w:br w:type="page"/></w:r></w:p>` : "";
  return `${pageBreak}<w:p><w:pPr><w:spacing w:after="180"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r></w:p>`;
}

export async function renderPdfPages(path: string, onProgress?: (message: string) => void) {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) throw new Error("Não foi possível carregar a tabela oficial do zoneamento.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()) }).promise;
  const pages: Blob[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    onProgress?.(`Preparando tabela do zoneamento · página ${pageNumber} de ${document.numPages}`);
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.65 });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("O navegador não conseguiu preparar a tabela do zoneamento.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Não foi possível converter a tabela do zoneamento.");
    pages.push(blob);
  }
  return pages;
}

export async function generateDocxFromTemplate({
  templatePath,
  fields,
  mapImage,
  mapMedia,
  zoningPages,
}: {
  templatePath: string;
  fields: GeneratedDocumentFields;
  mapImage?: Blob | null;
  mapMedia?: string[];
  zoningPages?: Blob[];
}) {
  const response = await fetch(templatePath, { cache: "force-cache" });
  if (!response.ok) throw new Error("Não foi possível carregar o modelo de documento.");
  const zip = new PizZip(await response.arrayBuffer());

  for (const fileName of Object.keys(zip.files)) {
    if (!/^word\/(?:document|header\d*|footer\d*)\.xml$/.test(fileName)) continue;
    const file = zip.file(fileName);
    if (file) zip.file(fileName, replaceTokens(file.asText(), fields));
  }

  if (mapImage && mapMedia?.length) {
    for (const mediaPath of mapMedia) {
      if (zip.file(mediaPath)) zip.file(mediaPath, await blobBytes(await imageForMedia(mapImage, mediaPath)), { binary: true });
    }
  }

  const images: DocumentImage[] = [];
  if (mapImage && !mapMedia?.length) images.push({ blob: mapImage, title: "Mapa do processo", pageBreakBefore: true });
  for (const [index, blob] of (zoningPages ?? []).entries()) {
    images.push({ blob, title: index === 0 ? `Uso e ocupação do solo — ${fields.zoning}` : `Uso e ocupação do solo — ${fields.zoning} · continuação`, pageBreakBefore: true });
  }

  if (images.length) {
    const relationshipsPath = "word/_rels/document.xml.rels";
    const relationshipsFile = zip.file(relationshipsPath);
    if (!relationshipsFile) throw new Error("O modelo não possui relacionamentos DOCX válidos.");
    let relationshipsXml = relationshipsFile.asText();
    let documentXml = zip.file("word/document.xml")?.asText();
    if (!documentXml) throw new Error("O modelo DOCX não possui corpo de documento válido.");
    const relationshipNumbers = [...relationshipsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
    let nextRelationship = Math.max(0, ...relationshipNumbers) + 1;
    const propertyNumbers = [...documentXml.matchAll(/<wp:docPr[^>]+id="(\d+)"/g)].map((match) => Number(match[1]));
    let nextProperty = Math.max(0, ...propertyNumbers) + 1;
    let appendix = "";

    for (const [index, image] of images.entries()) {
      const relationshipId = `rId${nextRelationship++}`;
      const mediaName = `generated-${Date.now()}-${index + 1}.png`;
      const size = await imageSize(image.blob);
      zip.file(`word/media/${mediaName}`, await blobBytes(image.blob), { binary: true });
      relationshipsXml = relationshipsXml.replace(
        "</Relationships>",
        `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
      );
      appendix += headingXml(image.title, image.pageBreakBefore ?? false);
      appendix += drawingXml(relationshipId, nextProperty++, mediaName, size.width, size.height);
    }

    const bodyEnd = documentXml.lastIndexOf("</w:body>");
    const finalSection = documentXml.lastIndexOf("<w:sectPr", bodyEnd);
    const insertionPoint = finalSection >= 0 ? finalSection : bodyEnd;
    if (insertionPoint < 0) throw new Error("O modelo DOCX não possui encerramento de corpo válido.");
    documentXml = `${documentXml.slice(0, insertionPoint)}${appendix}${documentXml.slice(insertionPoint)}`;
    zip.file("word/document.xml", documentXml);
    zip.file(relationshipsPath, relationshipsXml);
    const contentTypes = zip.file("[Content_Types].xml");
    if (contentTypes && !/Extension="png"/i.test(contentTypes.asText())) {
      zip.file("[Content_Types].xml", contentTypes.asText().replace("</Types>", `<Default Extension="png" ContentType="image/png"/></Types>`));
    }
  }

  return zip.generate({
    type: "blob",
    compression: "DEFLATE",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function downloadGeneratedDocument(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3_000);
}
