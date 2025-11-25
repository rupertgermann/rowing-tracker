import { extractText, getDocumentProxy } from 'unpdf';

// ============================================================================
// Image Processing
// ============================================================================

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

export interface ProcessedImage {
  resizedBlob: Blob;
  thumbnail: Blob;
  metadata: ImageMetadata;
}

const MAX_IMAGE_DIMENSION = 2048;
const THUMBNAIL_SIZE = 200;
const JPEG_QUALITY = 0.85;

/**
 * Process an image file: resize if too large, generate thumbnail
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);

      try {
        const metadata: ImageMetadata = {
          width: img.width,
          height: img.height,
          format: file.type,
        };

        // Resize if needed
        const resizedBlob = await resizeImage(img, MAX_IMAGE_DIMENSION, file.type);
        
        // Generate thumbnail
        const thumbnail = await resizeImage(img, THUMBNAIL_SIZE, 'image/jpeg');

        resolve({ resizedBlob, thumbnail, metadata });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Resize an image to fit within maxSize while maintaining aspect ratio
 */
async function resizeImage(
  img: HTMLImageElement,
  maxSize: number,
  outputType: string
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  let { width, height } = img;

  // Calculate new dimensions
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }

  canvas.width = width;
  canvas.height = height;

  // Draw resized image
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      outputType,
      JPEG_QUALITY
    );
  });
}

/**
 * Generate a base64 data URL from a blob
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// PDF Processing
// ============================================================================

export interface PDFMetadata {
  pageCount: number;
  title?: string;
  author?: string;
}

export interface ProcessedPDF {
  extractedText: string;
  metadata: PDFMetadata;
  thumbnail?: Blob;
}

/**
 * Process a PDF file: extract text and metadata
 */
export async function processPDF(file: File): Promise<ProcessedPDF> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));

    // Extract text
    const { totalPages, text } = await extractText(pdf, { mergePages: true });

    // Get metadata
    const metadata: PDFMetadata = {
      pageCount: totalPages,
    };

    // Try to extract PDF info (title, author)
    try {
      // The pdf object from getDocumentProxy has getMetadata method
      const pdfMetadata = await (pdf as unknown as { getMetadata?: () => Promise<{ info?: Record<string, unknown> }> }).getMetadata?.();
      if (pdfMetadata?.info) {
        metadata.title = pdfMetadata.info.Title as string | undefined;
        metadata.author = pdfMetadata.info.Author as string | undefined;
      }
    } catch {
      // Metadata extraction failed, continue without it
    }

    return {
      extractedText: text as string,
      metadata,
    };
  } catch (error) {
    console.error('PDF processing failed:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a PDF ArrayBuffer (for already loaded files)
 */
export async function extractPDFText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text as string;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    return '';
  }
}

// ============================================================================
// Generic File Processing
// ============================================================================

export type ProcessedDocument = 
  | { type: 'image'; data: ProcessedImage }
  | { type: 'pdf'; data: ProcessedPDF };

/**
 * Process any supported document type
 */
export async function processDocument(file: File): Promise<ProcessedDocument> {
  if (file.type.startsWith('image/')) {
    const data = await processImage(file);
    return { type: 'image', data };
  }

  if (file.type === 'application/pdf') {
    const data = await processPDF(file);
    return { type: 'pdf', data };
  }

  throw new Error(`Unsupported file type: ${file.type}`);
}

/**
 * Get a preview URL for a document
 */
export function getDocumentPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revoke a preview URL to free memory
 */
export function revokeDocumentPreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
