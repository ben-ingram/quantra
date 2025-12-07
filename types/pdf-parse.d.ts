declare module "pdf-parse" {
  interface PdfInfo {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
  }

  interface PdfMetadata {
    _metadata?: Record<string, unknown>;
  }

  interface PdfData {
    numpages: number;
    numrender: number;
    info: PdfInfo;
    metadata: PdfMetadata | null;
    text: string;
    version: string;
  }

  interface PdfOptions {
    pagerender?: (pageData: {
      pageIndex: number;
      getTextContent: () => Promise<{
        items: Array<{ str: string; transform?: number[] }>;
      }>;
    }) => Promise<string> | string;
    max?: number;
    version?: string;
  }

  function pdfParse(
    dataBuffer: Buffer | ArrayBuffer,
    options?: PdfOptions
  ): Promise<PdfData>;

  export = pdfParse;
}
